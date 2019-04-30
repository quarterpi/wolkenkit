'use strict';

const bodyParser = require('body-parser'),
      cors = require('cors'),
      express = require('express'),
      flatten = require('lodash/flatten'),
      nocache = require('nocache');

const V2 = require('./V2');

class Http {
  async initialize ({
    corsOrigin,
    onReceiveCommand,
    application,
    repository,
    identityProviders,
    heartbeatInterval = 90 * 1000
  }) {
    if (!corsOrigin) {
      throw new Error('CORS origin is missing.');
    }
    if (!onReceiveCommand) {
      throw new Error('On receive command is missing.');
    }
    if (!application) {
      throw new Error('Application is missing.');
    }
    if (!repository) {
      throw new Error('Repository is missing.');
    }
    if (!identityProviders) {
      throw new Error('Identity providers are missing.');
    }

    let transformedCorsOrigin;

    if (corsOrigin === '*') {
      transformedCorsOrigin = corsOrigin;
    } else {
      transformedCorsOrigin = flatten([ corsOrigin ]);
    }

    this.v2 = new V2({
      onReceiveCommand,
      application,
      repository,
      identityProviders,
      heartbeatInterval
    });

    this.api = express();

    this.api.options('*', cors({
      methods: [ 'GET', 'POST' ],
      origin: transformedCorsOrigin,
      optionsSuccessStatus: 200
    }));
    this.api.use(cors({
      methods: [ 'GET', 'POST' ],
      origin: transformedCorsOrigin,
      optionsSuccessStatus: 200
    }));

    this.api.use(nocache());
    this.api.use(bodyParser.json({ limit: '100kb' }));

    this.api.use('/v2', this.v2.api);
  }

  async sendEvent ({ event, metadata }) {
    if (!event) {
      throw new Error('Event is missing.');
    }
    if (!metadata) {
      throw new Error('Metadata are missing.');
    }

    await this.v2.sendEvent({ event, metadata });
  }
}

module.exports = Http;
