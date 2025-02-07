'use strict';

const connections = async function ({
  configuration,
  secret
}) {
  if (!configuration) {
    throw new Error('Configuration is missing');
  }
  if (!secret) {
    throw new Error('Secret is missing');
  }

  const result = {
    api: {
      container: {
        http: {
          hostname: 'broker',
          port: 80
        }
      },
      external: {
        https: {
          hostname: configuration.api.host.name,
          port: configuration.api.port
        },
        http: {
          hostname: configuration.api.host.name,
          port: configuration.api.port + 10
        }
      }
    },
    fileStorage: {
      container: {
        http: {
          hostname: 'depot',
          port: 80
        }
      },
      external: {
        https: {
          hostname: configuration.api.host.name,
          port: configuration.api.port + 1
        },
        http: {
          hostname: configuration.api.host.name,
          port: configuration.api.port + 11
        }
      }
    },
    debugging: {
      broker: {
        port: configuration.api.port + 20
      },
      core: {
        port: configuration.api.port + 21
      },
      flows: {
        port: configuration.api.port + 22
      }
    },
    eventStore: {
      type: 'postgres',
      container: {
        pg: {
          protocol: 'pg',
          user: 'wolkenkit',
          password: secret,
          database: 'wolkenkit',
          hostname: 'eventstore',
          port: 5432
        }
      },
      external: {
        pg: {
          protocol: 'pg',
          user: 'wolkenkit',
          password: secret,
          database: 'wolkenkit',
          hostname: configuration.api.host.name,
          port: configuration.api.port + 30
        }
      }
    },
    listStore: {
      type: 'mongodb',
      container: {
        mongodb: {
          protocol: 'mongodb',
          user: 'wolkenkit',
          password: secret,
          database: 'wolkenkit',
          hostname: 'liststore',
          port: 27017
        }
      },
      external: {
        mongodb: {
          protocol: 'mongodb',
          user: 'wolkenkit',
          password: secret,
          database: 'wolkenkit',
          hostname: configuration.api.host.name,
          port: configuration.api.port + 31
        }
      }
    },
    commandBus: {
      type: 'rabbitmq',
      container: {
        amqp: {
          protocol: 'amqp',
          user: 'wolkenkit',
          password: secret,
          hostname: 'messagebus',
          port: 5672
        },
        http: {
          port: 15672
        }
      },
      external: {
        amqp: {
          port: configuration.api.port + 32
        },
        http: {
          port: configuration.api.port + 33
        }
      }
    },
    eventBus: {
      type: 'rabbitmq',
      container: {
        amqp: {
          protocol: 'amqp',
          user: 'wolkenkit',
          password: secret,
          hostname: 'messagebus',
          port: 5672
        },
        http: {
          port: 15672
        }
      },
      external: {
        amqp: {
          port: configuration.api.port + 32
        },
        http: {
          port: configuration.api.port + 33
        }
      }
    },
    flowBus: {
      type: 'rabbitmq',
      container: {
        amqp: {
          protocol: 'amqp',
          user: 'wolkenkit',
          password: secret,
          hostname: 'messagebus',
          port: 5672
        },
        http: {
          port: 15672
        }
      },
      external: {
        amqp: {
          port: configuration.api.port + 32
        },
        http: {
          port: configuration.api.port + 33
        }
      }
    },
    s3: {
      type: 'minio',
      container: {
        minio: {
          protocol: 's3',
          accessKey: 'wolkenkit',
          secretKey: secret,
          hostname: 's3',
          port: 9000
        }
      },
      external: {
        minio: {
          protocol: 's3',
          accessKey: 'wolkenkit',
          secretKey: secret,
          hostname: configuration.api.host.name,
          port: configuration.api.port + 34
        }
      }
    }
  };

  return result;
};

module.exports = connections;
