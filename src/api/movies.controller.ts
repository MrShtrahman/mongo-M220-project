import { Response, Request, NextFunction } from 'express';
import MoviesDAO, { MflixMovie } from '../DAL/moviesDAL';

const MOVIES_PER_PAGE = 20;
export default class MoviesController {
  static async apiGetMovies(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { moviesList, totalNumResults } = await MoviesDAO.getMovies({} as MflixMovie, 0, MOVIES_PER_PAGE);
    const response = {
      movies: moviesList,
      page: 0,
      filters: {},
      entries_per_page: MOVIES_PER_PAGE,
      total_results: totalNumResults
    };
    res.json(response);
  }

  static async apiGetMoviesByCountry(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const countries = req.query.countries === '' ? 'USA' : req.query.countries;
    const countryList = Array.isArray(countries) ? countries : Array(countries);
    const moviesList = await MoviesDAO.getMoviesByCountry(countryList as string[]);
    const response = {
      titles: moviesList
    };
    res.json(response);
  }

  static async apiGetMovieById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = req.params.id || '';
      const movie = await MoviesDAO.getMovieByID(id);
      if (!movie) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      const updated_type = movie.lastupdated instanceof Date ? 'Date' : 'other';
      res.json({ movie, updated_type });
    } catch (e) {
      console.log(`api, ${e}`);
      res.status(500).json({ error: e });
    }
  }

  static async apiSearchMovies(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    let page: number;
    try {
      page = req.query.page ? parseInt(req.query.page + '', 10) : 0;
    } catch (e) {
      console.error(`Got bad value for page:, ${e}`);
      page = 0;
    }
    let searchType;
    try {
      searchType = Object.keys(req.query)[0];
    } catch (e) {
      console.error(`No search keys specified: ${e}`);
    }

    const filters = {} as any;

    switch (searchType) {
      case 'genre':
        if (req.query.genre !== '') {
          filters.genre = req.query.genre;
        }
        break;
      case 'cast':
        if (req.query.cast !== '') {
          filters.cast = req.query.cast as string[];
        }
        break;
      case 'text':
        if (req.query.text !== '') {
          filters.text = req.query.text as string;
        }
        break;
      default:
    }

    const { moviesList, totalNumResults } = await MoviesDAO.getMovies(
      filters,
      page,
      MOVIES_PER_PAGE
    );

    const response = {
      movies: moviesList,
      page: page,
      filters,
      entries_per_page: MOVIES_PER_PAGE,
      total_results: totalNumResults
    };

    res.json(response);
  }

  static async apiFacetedSearch(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {

    let page: number;
    try {
      page = req.query.page ? parseInt(req.query.page + '', 10) : 0;
    } catch (e) {
      console.error(`Got bad value for page, defaulting to 0: ${e}`);
      page = 0;
    }

    let filters = {} as any;

    filters =
      req.query.cast !== ''
        ? { cast: new RegExp(req.query.cast as string, 'i') }
        : { cast: 'Tom Hanks' };

    const facetedSearchResult = await MoviesDAO.facetedSearch(
      filters,
      page,
      MOVIES_PER_PAGE
    );

    const response = {
      movies: facetedSearchResult.movies,
      facets: {
        runtime: facetedSearchResult.runtime,
        rating: facetedSearchResult.rating
      },
      page: page,
      filters,
      entries_per_page: MOVIES_PER_PAGE,
      total_results: facetedSearchResult.count
    };

    res.json(response);
  }
}
