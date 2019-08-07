#!/usr/bin/env node

'use strict';

const buntstift = require('buntstift'),
  fs = require('fs'),
  path = require('path'),
  https = require('https');

const dockerDir = path.join(__dirname, '../docker');

async function scanDirectory(dir) {
  if (fs.existsSync(dir)){
    let contents = fs.readdir(dir, async (err, files) => {
      if (err) {
        throw Error(err);
      }

      let found = findDockerFiles(dir, files);
      await found;
      return found;
    });

    await contents;
debugger;
    if (contents !== undefined) {
      let fullPath = contents.map((file) => {
        return path.join(dir, file);
      });
      await fullPath;
      buntstift.info(fullPath);
      return fullPath;
    }
  }
}

async function findDockerFiles(dirname, files) {
  debugger;
  return await files.map(async (file) => {
    let currentPath = path.join(dirname, file);
    if (fs.existsSync(currentPath) && 
        fs.lstatSync(currentPath).isDirectory()) {
      try {
       await scanDirectory(currentPath);
      } catch (err) {
        buntstift.error('oops! '+err);
        buntstift.error('currentPath: '+currentPath);
      }
      
    } else if (fs.existsSync(currentPath) && fs.lstatSync(currentPath).isFile()) {
      debugger;
      if (file == "Dockerfile") {
        //buntstift.info(currentPath);
        return readDockerFile(currentPath);
        //return currentPath;
      }
    }
  });
}

async function readDockerFile(file) {
  if (fs.existsSync(file) && fs.lstatSync(file).isFile()) {
    try {
      await fs.readFile(file, (err, data) => {
        const patternFrom = /FROM\s(.+?):(.+?)\n/;
        const baseImage = patternFrom.exec(data);
        requestTags(baseImage[1], baseImage[2], 100);
      });
    } catch (err) {
    }
  }
}

async function requestTags(library, scheme, pageSize) {
  await https.get(`https://hub.docker.com/v2/repositories/library/${library}/tags/?page_size=${pageSize}`, (res) => {
    const { statusCode } = res;
    const contentType = res.headers['content-type'];

    let error;
    if (statusCode !== 200) {
      error = new Error(`Request Failed for ${library}.\n` + `Status Code: ${statusCode}`);
    } else if (!/^application\/json/.test(contentType)){
      error = new Error('Invalid content-type.\n' + `Expected application/json but recieved ${contentType}`);
    }
    if (error) {
      buntstift.error(error.message);
      res.resume();
      return;
    }

    res.setEncoding('utf8');
    let rawData = '';
    res.on('data', (chunk) => {rawData += chunk; });
    res.on('end', () => {
      try {
        const parsedData = JSON.parse(rawData);
        buntstift.info(parsedData.results);
      } catch (e) {
        buntstift.error(e);
      }
    });
  }).on('error', (e) => {
    buntstift.error(`Got error: ${e.message}`);
  }); 
}

(async () => {
  const stop = buntstift.wait();
    const found = scanDirectory(dockerDir);
    await found;
  stop();
    return found;
})();
