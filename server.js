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
    users: [User!]!
    user(id: ID!): User
  }

  type Mutation {
    userCreate(user: UserCreateInput!): User
    userUpdate(userId: ID!, user: UserUpdateInput!): User
    userDelete(userId: ID!): Boolean
  }

  type User {
    id: ID!
    name: String!
    bio: String
  }

  input UserCreateInput {
    name: String!
    bio: String
  }

  input UserUpdateInput {
    name: String
    bio: String
  }
`;

const resolvers = {
  Query: {
    users: async (_, __, context) => {
      const data = await context.mongo
        .db("wtf")
        .collection("users")
        .find()
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
    userCreate: async (_, { user }, context) => {
      const { insertedId } = await context.mongo
        .db("wtf")
        .collection("users")
        .insertOne(user);

      return { id: insertedId, ...user };
    },
    userUpdate: async (_, { userId, user }, context) => {
      const { _id, ...existingUser } = await context.mongo
        .db("wtf")
        .collection("users")
        .findOne({ _id: ObjectId(userId) });

      const data = await context.mongo
        .db("wtf")
        .collection("users")
        .updateOne({ _id }, { $set: user });

      return { id: userId, ...existingUser, ...user };
    },
    userDelete: async (_, { userId }, context) => {
      const { acknowledged } = await context.mongo
        .db("wtf")
        .collection("users")
        .deleteOne({ _id: ObjectId(userId) });

      return acknowledged;
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
