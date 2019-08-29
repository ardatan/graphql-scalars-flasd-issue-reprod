const express = require('express');
const app = express();
const withGraphql = require('./with-graphql');
withGraphql(app).listen(4000);