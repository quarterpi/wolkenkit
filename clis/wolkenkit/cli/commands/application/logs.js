'use strict';

const buntstift = require('buntstift'),
      getUsage = require('command-line-usage'),
      processenv = require('processenv');

const commands = require('../../../commands'),
      defaults = require('../../defaults.json'),
      globalOptionDefinitions = require('../../globalOptionDefinitions'),
      showProgress = require('../../showProgress');

const logs = {
  description: 'Fetch an application log.',

  async getOptionDefinitions () {
    return [
      {
        name: 'env',
        alias: 'e',
        type: String,
        defaultValue: processenv('WOLKENKIT_ENV') || defaults.env,
        description: 'select environment',
        typeLabel: '<env>'
      },
      {
        name: 'follow',
        type: Boolean,
        defaultValue: defaults.commands.application.logs.follow,
        description: 'follow log output'
      }
    ];
  },

  async run (options) {
    if (!options) {
      throw new Error('Options are missing.');
    }
    if (!options.env) {
      throw new Error('Environment is missing.');
    }
    if (options.follow === undefined) {
      throw new Error('Follow is missing.');
    }

    const directory = process.cwd(),
          { env, follow, help, verbose } = options;

    if (help) {
      return buntstift.info(getUsage([
        { header: 'wolkenkit application logs', content: this.description },
        { header: 'Synopsis', content: 'wolkenkit application logs [--env <env>] [--follow]' },
        { header: 'Options', optionList: [ ...await this.getOptionDefinitions(), ...globalOptionDefinitions ]}
      ]));
    }

    const stopWaiting = buntstift.wait();

    try {
      await commands.application.logs({
        directory,
        env,
        follow
      }, showProgress(verbose, stopWaiting));
    } catch (ex) {
      stopWaiting();
      buntstift.error('Failed to fetch application logs.');

      throw ex;
    }

    stopWaiting();
  }
};

module.exports = logs;
