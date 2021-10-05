require("dotenv").config();

const { MongoClient, ObjectId } = require("mongodb");
const express = require("express");
const { graphqlHTTP } = require("express-graphql");
const { makeExecutableSchema } = require("@graphql-tools/schema");

const connectToDb = async () => {
  const client = new MongoClient(process.env.MONGODB_URI, {
    useNewUrlParser: true,
  });

  let cachedConnection;

  if (cachedConnection) return cachedConnection;

  try {
    const connection = await client.connect();

    cachedConnection = connection;

    return connection;
  } catch (err) {
    console.error(err);
  }
};

const typeDefs = `
  type Query {
    users(limit: Int, skip: Int): [User]
    user(id: ID!): User
  }

  type Mutation {
    userCreate(input: UserInput!): UserCreatePayload
    userUpdate(input: UserInput!): UserUpdatePayload
    userDelete(input: UserDeleteInput!): UserDeletePayload
  }

  type User {
    id: ID!
    name: String!
    bio: String
  }

  input UserInput {
    id: ID
    name: String
    bio: String
  }

  input UserDeleteInput {
    id: ID!
  }

  type UserCreatePayload {
    user: User
  }

  type UserUpdatePayload {
    user: User
  }

  type UserDeletePayload {
    deletedUserId: ID
  }
`;

const resolvers = {
  Query: {
    users: async (_, { skip, limit }, context) => {
      const data = await context.mongo
        .db("wtf")
        .collection("users")
        .find()
        .skip(parseInt(skip, 10) || 0)
        .limit(parseInt(limit, 10) || 0)
        .map(({ _id, ...user }) => ({ ...user, id: _id }))
        .toArray();

      return data;
    },
    user: async (_, { id }, context) => {
      const { _id, ...user } = await context.mongo
        .db("wtf")
        .collection("users")
        .findOne({ _id: ObjectId(id) });

      return {
        id,
        ...user,
      };
    },
  },
  Mutation: {
    userCreate: async (_, { input }, context) => {
      const { insertedId } = await context.mongo
        .db("wtf")
        .collection("users")
        .insertOne(input);

      return { user: { id: insertedId, ...input } };
    },
    userUpdate: async (_, { input }, context) => {
      const { id, ...$set } = input;

      const { _id, ...existingUser } = await context.mongo
        .db("wtf")
        .collection("users")
        .findOne({ _id: ObjectId(id) });

      await context.mongo
        .db("wtf")
        .collection("users")
        .updateOne({ _id }, { $set });

      return { user: { id, ...existingUser, ...$set } };
    },
    userDelete: async (_, { input }, context) => {
      const { id } = input;

      await context.mongo
        .db("wtf")
        .collection("users")
        .deleteOne({ _id: ObjectId(id) });

      return {
        deletedUserId: id,
      };
    },
  },
};

const schema = makeExecutableSchema({ typeDefs, resolvers });

const app = express();

app.use(
  "/graphql",
  graphqlHTTP(async () => {
    const mongo = await connectToDb();

    return {
      schema,
      graphiql: true,
      context: {
        mongo,
      },
    };
  })
);

app.listen(process.env.PORT || 4000, () => {
  console.log(`Server started `);
});
