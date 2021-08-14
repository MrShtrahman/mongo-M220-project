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

MongoClient.connect(
  process.env.MFLIX_DB_URI || ''
  // TODO: Connection Pooling
  // Set the poolSize to 50 connections.
  // TODO: Timeouts
  // Set the write timeout limit to 2500 milliseconds.
)
  .catch(err => {
    console.error(err.stack);
    process.exit(1);
  })
  .then(client => {
    MoviesDAO.injectDB(client);
    UsersDAO.injectDB(client);
    CommentsDAO.injectDB(client);
    app.listen(port, () => {
      console.log(`listening on port ${port}`);
    });
  });
