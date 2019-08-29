const path = require('path');
const http = require('http');
const get = require('lodash.get');
const { typeDefs: scalarTypeDefs, resolvers: scalarResolvers } = require('graphql-scalars');
const { fileLoader, mergeTypes, mergeResolvers } = require('merge-graphql-schemas');
const { IsAuthenticatedDirective } = require('graphql-auth-directives');
const {
  ApolloServer, ApolloError, AuthenticationError, UserInputError,
} = require('apollo-server-express');
// const log = require('../services/logger');

const SCHEMAS_GLOB = path.join(__dirname, './**/*.schema.gql');
const RESOLVERS_GLOB = path.join(__dirname, './**/*.js');
const DIRECTIVES_SCHEMA_GLOB = path.join(__dirname, './**/*.directive.gql');
const DIRECTIVES_CLASS_GLOB = path.join(__dirname, './**/*.directive.js');

function createContext(partialContext = {}) {
  return ({ req, res }) => {
    // graphql-auth-directives expects a header object in the context.
    const headers = {
      Authorization: req.user && req.user.JWT,
    };

    const context = {
      req,
      res,
      headers,
      user: req.user,
      ...partialContext,
    };

    return context;
  };
}

function formatError(error) {
  if (process.env.NODE_ENV === 'development') {
    throw error;
  }

  // log(error);

  if (
    error instanceof ApolloError
    || error instanceof AuthenticationError
    || error instanceof UserInputError
    || get(error, ['extensions', 'exception', 'name'], false) === 'AuthorizationError'
  ) {
    throw error;
  }

  throw new Error('Something went wrong.');
}

function withGraphql(app, partialContext) {
  const typeDefs = mergeTypes([
    ...(fileLoader(SCHEMAS_GLOB)),
    ...(fileLoader(DIRECTIVES_SCHEMA_GLOB)),
    ...scalarTypeDefs,
  ]);

  const resolvers = mergeResolvers([
    ...(fileLoader(RESOLVERS_GLOB)),
    scalarResolvers,
  ]);

  const schemaDirectives = {
    ...(mergeResolvers([
      ...(fileLoader(DIRECTIVES_CLASS_GLOB)),
    ])),
    isAuthenticated: IsAuthenticatedDirective,
  };

  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    schemaDirectives,
    context: createContext(partialContext),
    formatError,
    playground: process.env.NODE_ENV === 'development' && {
      settings: {
        'request.credentials': 'include',
      },
    },
  });

  apollo.applyMiddleware({
    app,
    cors: false,
    disableHealthCheck: true,
  });

  const httpServer = http.createServer(app);

  apollo.installSubscriptionHandlers(httpServer);

  return httpServer;
}

module.exports = withGraphql;