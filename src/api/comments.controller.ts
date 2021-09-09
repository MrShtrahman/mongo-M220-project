import { Request, Response, NextFunction } from 'express';
import UsersDAO from '../DAL/usersDAL';
import CommentsDAO from '../DAL/commentsDAL';
import MoviesDAO from '../DAL/moviesDAL';
import { User } from './users.controller';
import { ObjectId } from 'bson';

export default class CommentsController {
  static async apiPostComment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userJwt = req.get('Authorization')?.slice('Bearer '.length);
      const user = await User.decoded(userJwt || '');
      const { error } = user;
      if (error) {
        res.status(401).json({ error });
        return;
      }

      const movieId = req.body.movie_id;
      const comment = req.body.comment;
      const date = new Date();

      const commentResponse = await CommentsDAO.addComment(
        new ObjectId(movieId),
        user,
        comment,
        date
      );

      const updatedComments = await MoviesDAO.getMovieByID(movieId);

      res.json({ status: 'success', comments: updatedComments?.comments });
    } catch (e) {
      res.status(500).json({ e });
    }
  }

  static async apiUpdateComment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userJwt = req.get('Authorization')?.slice('Bearer '.length);
      const user = await User.decoded(userJwt || '');
      const { error } = user;
      if (error) {
        res.status(401).json({ error });
        return;
      }

      const commentId = req.body.comment_id as string;
      const text = req.body.updated_comment;
      const date = new Date();

      const commentResponse = await CommentsDAO.updateComment(
        commentId,
        user.email,
        text,
        date
      );

      if (commentResponse.error) {
        res.status(400).json({ error: commentResponse.error });
      }

      if (commentResponse.modifiedCount === 0) {
        throw new Error(
          'unable to update comment - user may not be original poster'
        );
      }

      const movieId = req.body.movie_id;
      const updatedComments = await MoviesDAO.getMovieByID(movieId);

      res.json({ comments: updatedComments.comments });
    } catch (e) {
      res.status(500).json({ e });
    }
  }

  static async apiDeleteComment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userJwt = req.get('Authorization')?.slice('Bearer '.length);
      const user = await User.decoded(userJwt || '');
      const { error } = user;
      if (error) {
        res.status(401).json({ error });
        return;
      }

      const commentId = req.body.comment_id as string;
      const userEmail = user.email;
      const commentResponse = await CommentsDAO.deleteComment(
        commentId,
        userEmail
      );

      const movieId = req.body.movie_id as string;

      const { comments } = await MoviesDAO.getMovieByID(movieId);
      res.json({ comments });
    } catch (e) {
      res.status(500).json({ e });
    }
  }

  static async apiCommentReport(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userJwt = req.get('Authorization')?.slice('Bearer '.length);
      const user = await User.decoded(userJwt || '');
      const { error } = user;
      if (error) {
        res.status(401).json({ error });
        return;
      }

      if (await UsersDAO.checkAdmin(user.email)) {
        const report = await CommentsDAO.mostActiveCommenters();
        res.json({ report });
        return;
      }

      res.status(401).json({ status: 'fail' });
    } catch (e) {
      res.status(500).json({ e });
    }
  }
}
