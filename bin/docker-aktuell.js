#!/usr/bin/env node

'use strict';

const buntstift = require('buntstift'),
  fs = require('fs'),
  fsPromises = require('fs').promises,
  path = require('path'),
  https = require('https');

const dockerDir = path.join(__dirname, '../docker');

/*
 * Recursivly scans a directory and all sub-directories for Dockerfile(s).
 * @param dir {String} - the directory to scan.
 * @returns {Promise}
 */
async function scanDirectory(dir) {
  if (fs.existsSync(dir)){
    try {
      let contents = await fsPromises.readdir(dir);
      let found = await findDockerFiles(dir, contents);
      return found;
    } catch (err) {
      throw Error(err);
    }
  }
}

/*
 * Find Dockerfile(s) in a given directory.
 * @param dirname {String} - the directory to start looking in.
 * @param files {[String]} - the files contained in the directory.
 * @returns {Promise}
 */
async function findDockerFiles(dirname, files) {
  
  const found = await Promise.all(files.map(async file => {
    const currentPath = path.join(dirname, file);
    if (fs.existsSync(currentPath) && 
        fs.lstatSync(currentPath).isDirectory()) {
      try {
        const contents = await scanDirectory(currentPath);
        return contents;
      } catch (err) {
        buntstift.error('oops! '+err);
        buntstift.error('currentPath: '+currentPath);
      }
      
    } else if (fs.existsSync(currentPath) && fs.lstatSync(currentPath).isFile()) {
      if (file === "Dockerfile") {
        try {
          const scheme = await readDockerFile(currentPath);
          return scheme;
        } catch (err) {
          buntstift.error(err);
        }
      }
    }
  }));
  return found;
}

/*
 * Reads a docker file and requests the tags associated with the base image from
 * docker hub.
 * @param {path} - the file to read.
 * @returns {Promise}
 */
async function readDockerFile(file) {
  if (fs.existsSync(file) && fs.lstatSync(file).isFile()) {
    try {
      const image = await fsPromises.readFile(file).then( data => {
        const patternFrom = /FROM\s(.+?):(.+?)\n/;
        const patternUsername = /^([\w\.-]+?)\/(.+)$/;
        const baseImage = patternFrom.exec(data);
        if (patternUsername.test(baseImage[1])) {
          const lib = patternUsername.exec(baseImage[1]);
          //requestTags(lib[1], lib[2], baseImage[2], 200);
          return { 
            username: lib[1], 
            library: lib[2], 
            scheme: baseImage[2], 
            pageSize: 200
          };
        } else {
          //requestTags("library", baseImage[1], baseImage[2], 200);
          return { 
            username: 'library', 
            library: baseImage[1], 
            scheme: baseImage[2], 
            pageSize: 200
          };
        }
      }).catch(err => {
        buntstift.error(err);
      });
      return image;
    } catch (err) {
      buntstift.error(err);
    }
  }
}

/*
 * Extracts the image name (version number) and date from raw tag data.
 * @param data {{Object}} - The raw tag data from docker hub.
 * @returns {{name: String, lastUpdated: String}}
 */
async function extractNameAndUpDate(data) {
  return data.map((result) => {
    return {'name': result.name, 'lastUpdated': result.last_updated};
  });
}

/*
 * Parses a version scheme from which we can build a regex to match other schemes against.
 * @param scheme {String} - the scheme to parse.
 * @returns {[{type:String, data:[String]}]} - the scheme parsed into a consumable structure.
 */
async function parseScheme(scheme) {
  const toParse = scheme.split("");
  let char;
  let previousChar;
  let accumulator = [];
  let letter = /[a-zA-Z]/;
  let number = /[0-9]/;
  let symbol = /[\-\.]/;
  for (char of toParse) {
    if (letter.test(char)) {
        if (previousChar && previousChar.type == 'Letter') {
          accumulator[0].data.push(char);
        } else {
          accumulator.push({ 'type':'Letter', 'data':[char] });
        }
        previousChar = 'Letter';
    } else if (number.test(char)) {
        if (previousChar && previousChar.type == 'Number') {
          accumulator[0].data.push(char);
        } else {
           accumulator.push({ 'type':'Number', 'data':[char] });
        }
        previousChar = char;
    } else if (symbol.test(char)) {
        if (previousChar && previousChar.type == 'Symbol') {
          accumulator[0].data.push(char);
        } else {
           accumulator.push({ 'type':'Symbol', 'data':[char] });
        }
        previousChar = char;
    } else {
      throw `Unrecognized character ${char}`;
    }
  }
  return accumulator;
}

/*
 * Builds a regular expression to match image version names.
 * @param structuredScheme {[{type:String, data:[String]}]} - the scheme.
 * @returns {RegExp} - the regular expression generated based on the scheme.
 */
async function buildRegex(structuredScheme) {
  let regex = '^';
  for (let i=0; i<structuredScheme.length; i++) {
    switch (structuredScheme[i].type) {
      case 'Letter':
        for (let j=0; j<structuredScheme[i].data.length; j++) {
          regex += `${structuredScheme[i].data[j]}`;
        }
        break;
      case 'Number':
        if (i > 0 && structuredScheme[i-1].type !== 'Number') {
          regex += '\\d+?';
        } else if (i == 0) {
          regex += '\\d+?';
        }
        break;
      case 'Symbol':
        for (let j=0; j<structuredScheme[i].data.length; j++) {
          regex += `\\${structuredScheme[i].data[j]}`;
        }
        break;
      default:
        throw `Unrecognized structured scheme data type ${structuredScheme[i].type}`;
    }
  }
  regex += '$';
  regex = new RegExp(regex);
  return regex;
}

/*
 * Sorts images against a regular expression based on their name.
 * @param images {[{name:String, lastUpdated:String}]} - the images to sort.
 * @param regex {RegExp} - the regular expression to match.
 * @returns {[{name:String, lastUpdated:String}]} - the images that match the regex.
 */
async function sortImages(images, regex) {
  const matches = await images.map( (image) => {
    if (regex.test(image.name)) {
      return image;
    }
  });

  const filteredMatches = await matches.filter( (m) => {
    return m != null;
  });

  return filteredMatches;
}

/*
 * Extracts the number parts of a version scheme and leaves the rest behind.
 * @param scheme {String} - the scheme to extract numbers from.
 * @returns {[Number]} - an array of numbers making up the version.
 */
function extractNumbers(scheme) {
  const numbers = scheme.split(/\D/);
  const filteredNumbers = numbers.filter( (n) => {
    return n != '';
  });
  return filteredNumbers;
}

/*
 * Compairs two version numbers of the same scheme.
 * @param A {String} - the first version number
 * @param B {String} - the second version number
 * @returns {Number} - 0=AB, -1=Ab, 1=aB
 */
function compairVersions(A, B) {
  const versionA = extractNumbers(A.name); 
  const versionB = extractNumbers(B.name);
  for (let i=0; i<versionA.length; i++) {
    if (parseInt(versionA[i]) === parseInt(versionB[i])) {
      if (i < versionA.length -1) {
      continue;
      }
      return 0;
    } else if (parseInt(versionA[i]) > parseInt(versionB[i])) {
      return -1;
    } else {
      return 1;
    }
  }
}

/*
 * Given an array of images, finds the latest image based on their version number.
 * @param images {[{name:String, lastUpdated:String}]}
 * @param imageInUse {name:String, lastUpdated:String}
 * @returns {Promise}
 */
async function findLatest(images) {
  const latestFirst = images.sort(compairVersions); 
  if (imageInUse != null) {
    return {current: imageInUse, latest: latestFirst[0]};
  } else {
    // warn the user that the image in use could not be found and 
    // is either outdated or malformed
    return {current: null, latest: latestFirst[0]};
  }
}

/*
 * https.get that returns a Promise.
 * @param option - options to pass to https.get
 * @returns {Promise}
 */
function getPromise(option) {
  return new Promise((resolve, reject) => {
    let req = https.get(option, (res) => {
      if (res.statusCode < 200 || res.statusCode > 299) {
        reject( new Error(`Failed to load page ${res.statusCode}`));
      }

      let data = "";
      debugger;
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => { 
        try { 
          const parsedData = JSON.parse(data);
          resolve(parsedData);
        } catch(e){
          debugger;
         resolve(undefined);
        }
      });
    });
    req.on('error', (err) => reject(err));
  });
}

/*
 * GET tags from docker hub.
 * @param {String} username - the username of the repository to get tags for.
 * @param {String} library - the library to get tags for.
 * @param {String} scheme - the version scheme used by the image we use.
 * @param {Int} pageSize - the size of page to request (how many tags).
 * @returns {Promise}
 */
async function requestTags(username, library, scheme, pageSize) {
  try {
    const data = await getPromise(`https://hub.docker.com/v2/repositories/${username}/${library}/tags/?page_size=${pageSize}`);
    const results = await extractNameAndUpDate(data.results);
    const structuredScheme = await parseScheme(scheme);
    const generatedRegex = await buildRegex(structuredScheme);
    const matches = await sortImages(results, generatedRegex);
    const latest = matches.sort(compairVersions);
    return {username: username, library: library, current: scheme, latest: latest[0]};
  } catch (e) {
    return {username: username, library: library, current: scheme, latest: e.message};
  }
}

(async () => {
  const stop = buntstift.wait();
  const rawFiles = await scanDirectory(dockerDir); 
  const dockerfiles = await rawFiles.filter( (f) => {
    return f != null;
  });
  const images = await Promise.all(dockerfiles.map(async (tag) => {
    if (tag != null) {
      buntstift.info(`Found ${tag[0].library}`);
      const tags = await requestTags(
        tag[0].username, 
        tag[0].library, 
        tag[0].scheme, 
        tag[0].pageSize);
      return tags;
    }
  }));
  stop();
  buntstift.info(`Username    Library    Current     Latest     Last Updated`);
  images.map((img) => {
    if (img && img.latest.name != null) {
      if (img.current == img.latest.name) {
        buntstift.success(`${img.library}  ${img.current}  ${img.latest.name}  ${img.latest.lastUpdated}`);
      } else {
        buntstift.warn(`${img.library}  ${img.current}  ${img.latest.name}  ${img.latest.lastUpdated}`);
      }
      
    } else if (img != null) {
      buntstift.error(`${img.library}  ${img.current}  ${img.latest}`);
    } else {
      buntstift.error(`Encountered a Fatal Error. Good Bye Cruel World.`);
      //buntstift.exit();
    }
  });
  /*
  buntstift.table([
    ['Username', 'Library', 'Current', 'Latest', 'Last Updated'],
    [],
  ]); */
  //buntstift.info(found);
})();
