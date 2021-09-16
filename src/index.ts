import app from './server';
import { MongoClient } from 'mongodb';
import MoviesDAO from './DAL/moviesDAL';
import UsersDAO from './DAL/usersDAL';
import CommentsDAO from './DAL/commentsDAL';

const port = process.env.PORT || 8000;

/**
Ticket: Connection Pooling

Please change the configuration of the MongoClient object by setting the
maximum connection pool size to 50 active connections.
*/

/**
Ticket: Timeouts

Please prevent the program from waiting indefinitely by setting the write
concern timeout limit to 2500 milliseconds.
*/

(async () => {
  let client: MongoClient;
  try {
    client = await MongoClient.connect(process.env.MFLIX_DB_URI || '', {
      maxPoolSize: 50,
      wtimeoutMS: 2500
    });
    // TODO: Connection Pooling
    // Set the poolSize to 50 connections.
    // TODO: Timeouts
    // Set the write timeout limit to 2500 milliseconds.
    MoviesDAO.injectDB(client);
    UsersDAO.injectDB(client);
    CommentsDAO.injectDB(client);
    app.listen(port, () => console.log(`listening on port ${port}`));
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
