import { ObjectId } from 'bson';
import { Collection, MongoClient, Db, Document, MongoClientOptions } from 'mongodb';

// This is a parsed query, sort, and project bundle.
interface QueryParams {
  query: Record<string, any>;
  sort: any[];
  project: Record<string, any>;
}

// Represents a single country result
interface CountryResult {
  ObjectID: string;
  title: string;
}

interface ConfigurationResult {
  poolSize: number;
  wtimeout: number;
  authInfo: any;
}

// A Movie from mflix
export interface MflixMovie {
  _id: string;
  title: string;
  year: number;
  runtime: number;
  released: Date;
  text: string;
  cast: string[];
  metacriticd: number;
  poster: string;
  plot: string;
  fullplot: string;
  lastupdated: string | Date;
  type: string;
  languages: string[];
  directors: string[];
  writers: string[];
  imdb: IMDB[];
  countries: string[];
  rated: string[];
  genres: string[];
  genre: string[];
  comments: string[];
}

// IMDB subdocument
interface IMDB {
  rating: number;
  votes: number;
  id: number;
}

// Result set for getMovies method
interface GetMoviesResult {
  moviesList: MflixMovie[];
  totalNumResults: number;
}

/**
 * Faceted Search Return
 *
 * The type of return from faceted search. It will be a single document with
 * 3 fields: rating, runtime, and movies.
 */
interface FacetedSearchReturn {
  rating: Record<string, any>;
  runtime: Record<string, any>;
  movies: MflixMovie[];
  count: number;
}

let movies: Collection;
let mflix: Db;
let clientOptions: MongoClientOptions;
const DEFAULT_SORT = [['tomatoes.viewer.numReviews', -1]];

export default class MoviesDAO {
  static movies: Collection<Document>;
  static injectDB(conn: MongoClient): void {
    if (movies) {
      return;
    }
    try {
      mflix = conn.db(process.env.MFLIX_NS);
      movies = conn.db(process.env.MFLIX_NS).collection('movies');
      clientOptions = conn.options;
      this.movies = movies; // this is only for testing
    } catch (e) {
      console.error(
        `Unable to establish a collection handle in moviesDAO: ${e}`
      );
    }
  }

  /**
   * Retrieves the connection pool size, write concern and user roles on the
   * current client.
   * @returns {Promise<ConfigurationResult>} An object with configuration details.
   */
  static async getConfiguration(): Promise<MongoClientOptions> {
    const roleInfo = await mflix.command({ connectionStatus: 1 })
    const auth = roleInfo.authInfo.authenticatedUserRoles[0]
    const { maxPoolSize, wtimeoutMS } = clientOptions;
    const response: MongoClientOptions = {
      auth,
      maxPoolSize,
      wtimeoutMS
    }
    return response;
  }

  /**
   * Finds and returns movies originating from one or more countries.
   * Returns a list of objects, each object contains a title and an _id.
   * @param {string[]} countries - The list of countries.
   * @returns {Promise<CountryResult>} A promise that will resolve to a list of CountryResults.
   */
  static async getMoviesByCountry(
    countries: string[]
  ): Promise<Document[]> {
    /**
    Ticket: Projection

    Write a query that matches movies with the countries in the "countries"
    list, but only returns the title and _id of each movie.

    Remember that in MongoDB, the $in operator can be used with a list to
    match one or more values of a specific field.
    */

    let cursor;
    try {
      // TODO Ticket: Projection
      // Find movies matching the "countries" list, but only return the title
      // and _id. Do not put a limit in your own implementation, the limit
      // here is only included to avoid sending 46000 documents down the
      // wire.
      cursor = movies.find({ countries: { $in: countries } }).project({ title: 1 });
    } catch (e) {
      console.error(`Unable to issue find command, ${e}`);
      return [];
    }

    return cursor.toArray();
  }

  /**
   * Finds and returns movies matching a given text in their title or description.
   * @param {string} text - The text to match with.
   * @returns {QueryParams} The QueryParams for text search
   */
  static textSearchQuery(text: string): QueryParams {
    const query = { $text: { $search: text } };
    const meta_score = { $meta: 'textScore' };
    const sort = [['score', meta_score]];
    const project = { score: meta_score };

    return { query, project, sort };
  }

  /**
   * Finds and returns movies including one or more cast members.
   * @param {string[]} cast - The cast members to match with.
   * @returns {QueryParams} The QueryParams for cast search
   */
  static castSearchQuery(cast: string[]): QueryParams {
    const searchCast = Array.isArray(cast) ? cast : Array(cast);
    const query = { cast: { $in: searchCast } };
    const project = {};
    const sort = DEFAULT_SORT;

    return { query, project, sort };
  }

  /**
   * Finds and returns movies matching a one or more genres.
   * @param {string[]} genre - The genres to match with.
   * @returns {QueryParams} The QueryParams for genre search
   */
  static genreSearchQuery(genre: string[]): QueryParams {
    /**
    Ticket: Text and Subfield Search

    Given an array of one or more genres, construct a query that searches
    MongoDB for movies with that genre.
    */
   const searchGenre = Array.isArray(genre) ? genre : Array(genre);
    // TODO Ticket: Text and Subfield Search
    // Construct a query that will search for the chosen genre.
    const query = { genres: { $in: searchGenre } };
    const project = {};
    const sort = DEFAULT_SORT;

    return { query, project, sort };
  }

  /**
   *
   * @param {Object} filters - The search parameter to use in the query. Comes
   * in the form of `{cast: { $in: [...castMembers]}}`
   * @param {number} page - The page of movies to retrieve.
   * @param {number} moviesPerPage - The number of movies to display per page.
   * @returns {FacetedSearchReturn} FacetedSearchReturn
   */
  static async facetedSearch(
    filters: MflixMovie,
    page: number,
    moviesPerPage: number
  ): Promise<any> {
    if (!filters || !filters.cast) {
      throw new Error('Must specify cast members to filter by.');
    }
    const matchStage = { $match: filters };
    const sortStage = { $sort: { 'tomatoes.viewer.numReviews': -1 } };
    const countingPipeline: Document[] = [matchStage, sortStage, { $count: 'count' }];
    const skipStage = { $skip: moviesPerPage * page };
    const limitStage = { $limit: moviesPerPage };
    const facetStage = {
      $facet: {
        runtime: [
          {
            $bucket: {
              groupBy: '$runtime',
              boundaries: [0, 60, 90, 120, 180],
              default: 'other',
              output: {
                count: { $sum: 1 }
              }
            }
          }
        ],
        rating: [
          {
            $bucket: {
              groupBy: '$metacritic',
              boundaries: [0, 50, 70, 90, 100],
              default: 'other',
              output: {
                count: { $sum: 1 }
              }
            }
          }
        ],
        movies: [
          {
            $addFields: {
              title: '$title'
            }
          }
        ]
      }
    };

    /**
    Ticket: Faceted Search

    Please append the skipStage, limitStage, and facetStage to the queryPipeline
    (in that order). You can accomplish this by adding the stages directly to
    the queryPipeline.

    The queryPipeline is a Javascript array, so you can use push() or concat()
    to complete this task, but you might have to do something about `const`.
    */

    const queryPipeline: Document[] = [
      matchStage,
      sortStage,
      skipStage,
      limitStage,
      facetStage
      // TODO Ticket: Faceted Search
      // Add the stages to queryPipeline in the correct order.
    ];

    try {
      const results = await movies.aggregate(queryPipeline).next();
      const count = await movies.aggregate(countingPipeline).next();
      return {
        ...results,
        ...count
      };
    } catch (e) {
      return { error: 'Results too large, be more restrictive in filter' };
    }
  }

  /**
   * Finds and returns movies by country.
   * Returns a list of objects, each object contains a title and an _id.
   * @param {Object} filters - The search parameters to use in the query.
   * @param {number} page - The page of movies to retrieve.
   * @param {number} moviesPerPage - The number of movies to display per page.
   * @returns {GetMoviesResult} An object with movie results and total results
   * that would match this query
   */
  static async getMovies(
    filters: MflixMovie,
    page: number,
    moviesPerPage: number): Promise<GetMoviesResult> {
    let queryParams = {} as QueryParams;
    if (filters) {
      if ('text' in filters) {
        queryParams = this.textSearchQuery(filters['text']);
      } else if ('cast' in filters) {
        queryParams = this.castSearchQuery(filters['cast']);
      } else if ('genre' in filters) {
        queryParams = this.genreSearchQuery(filters['genre']);
      }
    }

    const { query = {}, project = {}, sort = DEFAULT_SORT } = queryParams;
    let cursor;
    try {
      cursor = movies.find(query).project(project).sort(sort).skip(page * moviesPerPage);
    } catch (e) {
      console.error(`Unable to issue find command, ${e}`);
      return { moviesList: [], totalNumResults: 0 };
    }

    /**
    Ticket: Paging

    Before this method returns back to the API, use the "moviesPerPage" and
    "page" arguments to decide the movies to display.

    Paging can be implemented by using the skip() and limit() cursor methods.
    */

    // TODO Ticket: Paging
    // Use the cursor to only return the movies that belong on the current page
    const displayCursor = cursor.limit(moviesPerPage);

    try {
      const moviesList = await displayCursor.toArray() as MflixMovie[];
      const totalNumResults = page === 0 ? await movies.countDocuments(query) : 0;

      return { moviesList, totalNumResults };
    } catch (e) {
      console.error(
        `Unable to convert cursor to array or problem counting documents, ${e}`
      );
      return { moviesList: [], totalNumResults: 0 };
    }
  }

  /**
   * Gets a movie by its id
   * @param {string} id - The desired movie id, the _id in Mongo
   * @returns {MflixMovie | null} Returns either a single movie or nothing
   */
  static async getMovieByID(id: string): Promise<any> {
    try {
      /**
      Ticket: Get Comments

      Given a movie ID, build an Aggregation Pipeline to retrieve the comments
      matching that movie's ID.

      The $match stage is already completed. You will need to add a $lookup
      stage that searches the `comments` collection for the correct comments.
      */

      // TODO Ticket: Get Comments
      // Implement the required pipeline.
      const pipeline = [
        {
          $match: {
            _id: new ObjectId(id),
          },
        },
        {
          $lookup: {
            from: "comments",
            let: { id: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$movie_id", "$$id"],
                  },
                },
              },
              {
                $sort: {
                  date: -1,
                },
              },
            ],
            as: "comments",
          },
        },
      ]
      return await movies.aggregate(pipeline).next();
    } catch (e) {
      /**
      Ticket: Error Handling

      Handle the error that occurs when an invalid ID is passed to this method.
      When this specific error is thrown, the method should return `null`.
      */

      // TODO Ticket: Error Handling
      // Catch the InvalidId error by string matching, and then handle it.
      console.error(`Something went wrong in getMovieByID: ${e}`);
      return null;
    }
  }
}
