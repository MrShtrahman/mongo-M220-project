import { MongoClient, Collection, Document, UpdateResult } from 'mongodb';
import { Jwt } from 'jsonwebtoken';

interface UserInfo {
  name: string;
  password: string;
  email: string;
}

let users: Collection;
let sessions: Collection;

export default class UsersDAO {
  static injectDB(conn: MongoClient): void {
    if (users && sessions) {
      return;
    }
    try {
      users = conn.db(process.env.MFLIX_NS).collection('users');
      sessions = conn.db(process.env.MFLIX_NS).collection('sessions');
    } catch (e) {
      console.error(`Unable to establish collection handles in userDAO: ${e}`);
    }
  }

  /**
  Ticket: UserInfo Management

  For this ticket, you will need to implement the following five methods:

  - getUser
  - addUser
  - loginUser
  - logoutUser
  - getUserSession

  You can find these methods below this comment. Make sure to read the comments
  in each method to better understand the implementation.

  The method deleteUser is already given to you.
  */

  /**
   * Finds a user in the `users` collection
   * @param {string} email - The email of the desired user
   * @returns {Object | null} Returns either a single user or nothing
   */
  static async getUser(email: string): Promise<Document | undefined> {
    // TODO Ticket: UserInfo Management
    // Retrieve the user document corresponding with the user's email.
    return await users.findOne({ someField: 'someValue' });
  }

  /**
   * Adds a user to the `users` collection
   * @param {UserInfo} userInfo - The information of the user to add
   * @returns {DALResponse} Returns either a "success" or an "error" Object
   */
  static async addUser(userInfo: UserInfo): Promise<DALResponse> {
    /**
    Ticket: Durable Writes

    Please increase the durability of this method by using a non-default write
    concern with ``insertOne``.
    */

    try {
      // TODO Ticket: UserInfo Management
      // Insert a user with the "name", "email", and "password" fields.
      // TODO Ticket: Durable Writes
      // Use a more durable Write Concern for this operation.
      await users.insertOne({ someField: 'someValue' });
      return { success: true };
    } catch (e) {
      if (String(e).startsWith('MongoError: E11000 duplicate key error')) {
        return { error: 'A user with the given email already exists.' };
      }
      console.error(`Error occurred while adding new user, ${e}.`);
      return { error: e };
    }
  }

  /**
   * Adds a user to the `sessions` collection
   * @param {string} email - The email of the user to login
   * @param {string} jwt - A JSON web token representing the user's claims
   * @returns {DALResponse} Returns either a "success" or an "error" Object
   */
  static async loginUser(email: string, jwt: Jwt): Promise<DALResponse> {
    try {
      // TODO Ticket: UserInfo Management
      // Use an UPSERT statement to update the "jwt" field in the document,
      // matching the "user_id" field with the email passed to this function.
      await sessions.updateOne(
        { someField: 'someValue' },
        { $set: { someOtherField: 'someOtherValue' } }
      );
      return { success: true };
    } catch (e) {
      console.error(`Error occurred while logging in user, ${e}`);
      return { error: e };
    }
  }

  /**
   * Removes a user from the `sessons` collection
   * @param {string} email - The email of the user to logout
   * @returns {DALResponse} Returns either a "success" or an "error" Object
   */
  static async logoutUser(email: string): Promise<DALResponse> {
    try {
      // TODO Ticket: UserInfo Management
      // Delete the document in the `sessions` collection matching the email.
      await sessions.deleteOne({ someField: 'someValue' });
      return { success: true };
    } catch (e) {
      console.error(`Error occurred while logging out user, ${e}`);
      return { error: e };
    }
  }

  /**
   * Gets a user from the `sessions` collection
   * @param {string} email - The email of the user to search for in `sessions`
   * @returns {Object | null} Returns a user session Object, an "error" Object
   * if something went wrong, or null if user was not found.
   */
  static async getUserSession(email: string): Promise<Document | undefined> {
    try {
      // TODO Ticket: UserInfo Management
      // Retrieve the session document corresponding with the user's email.
      return sessions.findOne({ someField: 'someValue' });
    } catch (e) {
      console.error(`Error occurred while retrieving user session, ${e}`);
      return;
    }
  }

  /**
   * Removes a user from the `sessions` and `users` collections
   * @param {string} email - The email of the user to delete
   * @returns {DALResponse} Returns either a "success" or an "error" Object
   */
  static async deleteUser(email: string): Promise<DALResponse> {
    try {
      await users.deleteOne({ email });
      await sessions.deleteOne({ user_id: email });
      if (!(await this.getUser(email)) && !(await this.getUserSession(email))) {
        return { success: true };
      } else {
        console.error(`Deletion unsuccessful`);
        return { error: `Deletion unsuccessful` };
      }
    } catch (e) {
      console.error(`Error occurred while deleting user, ${e}`);
      return { error: e };
    }
  }

  /**
   * Given a user's email and an object of new preferences, update that user's
   * data to include those preferences.
   * @param {string} email - The email of the user to update.
   * @param {Object} preferences - The preferences to include in the user's data.
   * @returns {DALResponse}
   */
  static async updatePreferences(
    email: string,
    preferences: any
  ): Promise<Document | UpdateResult> {
    try {
      /**
      Ticket: UserInfo Preferences

      Update the "preferences" field in the corresponding user's document to
      reflect the new information in preferences.
      */

      preferences = preferences || {};

      // TODO Ticket: UserInfo Preferences
      // Use the data in "preferences" to update the user's preferences.
      const updateResponse = await users.updateOne(
        { someField: '' },
        { $set: { someOtherField: '' } }
      );

      if (updateResponse.matchedCount === 0) {
        return { error: 'No user found with that email' };
      }
      return updateResponse;
    } catch (e) {
      console.error(
        `An error occurred while updating this user's preferences, ${e}`
      );
      return { error: e };
    }
  }

  static async checkAdmin(email: string): Promise<boolean | DALResponse> {
    try {
      // const { isAdmin } = await this.getUser(email);
      const isAdmin = true;
      return isAdmin || false;
    } catch (e) {
      return { error: e };
    }
  }

  static async makeAdmin(email: string): Promise<Document | UpdateResult> {
    try {
      const updateResponse = users.updateOne(
        { email },
        { $set: { isAdmin: true } }
      );
      return updateResponse;
    } catch (e) {
      return { error: e };
    }
  }
}
