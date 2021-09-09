import { Response, Request, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import UsersDAO from '../DAL/usersDAL';

const hashPassword = async (password: string) =>
  await bcrypt.hash(password, 10);

interface UserType {
  name: string;
  email: string;
  password?: string;
  preferences: Record<string, any>;
  general?: string;
}

export class User {
  name: string;
  email: string;
  password: string;
  preferences: Record<string, any>;

  constructor(
    name: string,
    email: string,
    password: string,
    preferences: Record<string, any>
  ) {
    this.name = name;
    this.email = email;
    this.password = password;
    this.preferences = preferences;
  }
  toJson(): UserType {
    return {
      name: this.name,
      email: this.email,
      preferences: this.preferences
    };
  }
  async comparePassword(plainText: string): Promise<boolean> {
    return await bcrypt.compare(plainText, this.password);
  }
  encoded(): string {
    return jwt.sign(
      {
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4,
        ...this.toJson()
      },
      process.env.SECRET_KEY || ''
    );
  }
  static async decoded(userJwt: string): Promise<any> {
    return jwt.verify(userJwt, process.env.SECRET_KEY || '', (error, res) => {
      if (error) {
        return { error };
      }
      const userFromDecoding = res as UserType;
      return new User(userFromDecoding?.name, userFromDecoding?.email, userFromDecoding?.password || '', userFromDecoding.preferences);
    });
  }
}

export default class UserController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const userFromBody = req.body;
      const errors = {} as UserType;
      if (userFromBody && userFromBody.password.length < 8) {
        errors.password = 'Your password must be at least 8 characters.';
      }
      if (userFromBody && userFromBody.name.length < 3) {
        errors.name = 'You must specify a name of at least 3 characters.';
      }

      if (Object.keys(errors).length > 0) {
        res.status(400).json(errors);
        return;
      }

      const userInfo = {
        ...userFromBody,
        password: await hashPassword(userFromBody.password)
      };

      const insertResult = await UsersDAO.addUser(userInfo);
      if (!insertResult.success) {
        errors.email = insertResult.error + '';
      }
      const userFromDB = await UsersDAO.getUser(userFromBody.email) as UserType;
      if (!userFromDB) {
        errors.general = 'Internal error, please try again later';
      }

      if (Object.keys(errors).length > 0) {
        res.status(400).json(errors);
        return;
      }

      const user = new User(userFromDB.name, userFromDB.email, userFromDB.password || '', userFromDB.preferences);

      res.json({
        auth_token: user.encoded(),
        info: user.toJson()
      });
    } catch (e) {
      res.status(500).json({ error: e });
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      if (!email || typeof email !== 'string') {
        res.status(400).json({ error: 'Bad email format, expected string.' });
        return;
      }
      if (!password || typeof password !== 'string') {
        res
          .status(400)
          .json({ error: 'Bad password format, expected string.' });
        return;
      }
      const userData = await UsersDAO.getUser(email) as UserType;
      if (!userData) {
        res.status(401).json({ error: 'Make sure your email is correct.' });
        return;
      }
      const user = new User(userData.name, userData.email, userData.password || '', userData.preferences);

      if (!(await user.comparePassword(password))) {
        res.status(401).json({ error: 'Make sure your password is correct.' });
        return;
      }

      const loginResponse = await UsersDAO.loginUser(
        user.email,
        user.encoded()
      );
      if (!loginResponse.success) {
        res.status(500).json({ error: loginResponse.error });
        return;
      }
      res.json({ auth_token: user.encoded(), info: user.toJson() });
    } catch (e) {
      res.status(400).json({ error: e });
      return;
    }
  }

  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const userJwt = req.get('Authorization')?.slice('Bearer '.length);
      const userObj = await User.decoded(userJwt || '');
      const logoutResult = await UsersDAO.logoutUser(userObj.email);
      if (logoutResult.error) {
        res.status(500).json({ error: logoutResult.error });
        return;
      }
      res.json(logoutResult);
    } catch (e) {
      res.status(500).json(e);
    }
  }

  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const { password } = req.body;
      if (!password || typeof password !== 'string') {
        res
          .status(400)
          .json({ error: 'Bad password format, expected string.' });
        return;
      }
      const userJwt = req.get('Authorization')?.slice('Bearer '.length);
      const userClaim = await User.decoded(userJwt || '');
      if (userClaim.error) {
        res.status(401).json({ error: userClaim.error });
        return;
      }
      const userFromDB = await UsersDAO.getUser(userClaim.email);
      const user = new User(userFromDB?.name, userFromDB?.email, userFromDB?.password, userFromDB?.preferences);
      if (!(await user.comparePassword(password))) {
        res.status(401).json({ error: 'Make sure your password is correct.' });
        return;
      }
      const deleteResult = await UsersDAO.deleteUser(userClaim.email);
      const { error } = deleteResult;
      if (error) {
        res.status(500).json({ error });
        return;
      }
      res.json(deleteResult);
    } catch (e) {
      res.status(500).json(e);
    }
  }

  static async save(req: Request, res: Response): Promise<void> {
    try {
      const userJwt = req.get('Authorization')?.slice('Bearer '.length);
      const userFromHeader = await User.decoded(userJwt || '');
      const { error } = userFromHeader;
      if (error) {
        res.status(401).json({ error });
        return;
      }

      await UsersDAO.updatePreferences(
        userFromHeader.email,
        req.body.preferences
      );
      const userFromDB = await UsersDAO.getUser(userFromHeader.email);
      const updatedUser = new User(userFromDB?.name, userFromDB?.email, userFromDB?.password, userFromDB?.preferences);

      res.json({
        auth_token: updatedUser.encoded(),
        info: updatedUser.toJson()
      });
    } catch (e) {
      res.status(500).json(e);
    }
  }

  // for internal use only
  static async createAdminUser(req: Request, res: Response): Promise<void> {
    try {
      const userFromBody = req.body;
      const errors = {} as UserType;
      if (userFromBody && userFromBody.password.length < 8) {
        errors.password = 'Your password must be at least 8 characters.';
      }
      if (userFromBody && userFromBody.name.length < 3) {
        errors.name = 'You must specify a name of at least 3 characters.';
      }

      if (Object.keys(errors).length > 0) {
        res.status(400).json(errors);
        return;
      }

      const userInfo = {
        ...userFromBody,
        password: await hashPassword(userFromBody.password)
      };

      const insertResult = await UsersDAO.addUser(userInfo);
      if (!insertResult.success) {
        errors.email = insertResult.error + '';
      }

      if (Object.keys(errors).length > 0) {
        res.status(400).json(errors);
        return;
      }

      const makeAdminResponse = await UsersDAO.makeAdmin(userFromBody.email);

      const userFromDB = await UsersDAO.getUser(userFromBody.email) as UserType;
      if (!userFromDB) {
        errors.general = 'Internal error, please try again later';
      }

      if (Object.keys(errors).length > 0) {
        res.status(400).json(errors);
        return;
      }

      const user = new User(userFromDB.name, userFromDB.email, userFromDB.password || '', userFromDB.preferences);
      const jwt = user.encoded();
      const loginResponse = await UsersDAO.loginUser(user.email, jwt);

      res.json({
        auth_token: jwt,
        info: user.toJson()
      });
    } catch (e) {
      res.status(500).json(e);
    }
  }
}
