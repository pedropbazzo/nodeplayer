var config = require(process.env.HOME + '/.partyplayConfig.js');
var creds = require(process.env.HOME + '/.googlePlayCreds.json');

var gmusicBackend = {};

var gmusicDownload = function(startUrl, songID, callback, errCallback) {
    var doDownload = function(streamUrl) {
        console.log('downloading song ' + songID);
        var filePath = songCachePath + '/' + songID + '.mp3';
        var songFd = fs.openSync(filePath, 'w');

        var req = https.request(streamUrl, function(res) {

            res.on('data', function(chunk) {
                fs.writeSync(songFd, chunk, 0, chunk.length, null);
                //player.stdin.write(chunk);
            });
            res.on('end', function() {
                if(res.statusCode === 302) { // redirect
                    console.log('redirected. retrying with new URL');
                    fs.closeSync(songFd);
                    fs.unlinkSync(songCachePath + '/' + songID + '.mp3');
                    gmusicDownload(res.headers.location, songID, callback, errCallback);
                } else if(res.statusCode === 200) {
                    console.log('download finished ' + songID);
                    fs.closeSync(songFd);
                    if(callback)
                        callback(songID);
                    //player.stdin.end();
                } else {
                    console.log('ERROR: unknown status code ' + res.statusCode);
                    fs.closeSync(songFd);
                    fs.unlinkSync(songCachePath + '/' + songID + '.mp3');
                    if(errCallback)
                        errCallback(songID);
                }
            });
        });
        req.on('error', function(e) {
            console.log('error ' + e + ' while fetching! reconnecting in 5s...');
            setTimeout(function() {
                initPm(function() {
                    console.log('error while fetching! now reconnected to gmusic');
                    pm.getStreamUrl(songID, function(streamUrl) {
                        gmusicDownload(streamUrl, songID, callback, errCallback);
                    });
                });
            }, 5000);
        });
        req.end();
    };

    if(startUrl) {
        doDownload(startUrl);
    } else {
        pm.getStreamUrl(songID, function(streamUrl) {
            doDownload(streamUrl);
        });
    }
};

var fs = require('fs');
var PlayMusic = require('playmusic');

gmusicBackend.cache = function(songID, callback, errCallback) {
    var filePath = songCachePath + '/' + songID + '.mp3';

    if(fs.existsSync(filePath)) {
        // song was found from cache
        if(callback)
            callback(songID);
        return;
    } else {
        // song had to be downloaded
        gmusicDownload(null, songID, callback, errCallback);
    }
};
gmusicBackend.search = function(terms, callback, errCallback) {
    pm.search(terms, config.searchResultCnt + 1, function(data) {
        var songs = [];

        if(data.entries) {
            songs = data.entries.sort(function(a, b) {
                return a.score < b.score; // sort by score
            }).filter(function(entry) {
                return entry.type === '1'; // songs only, no albums/artists
            });

            for(var i = 0; i < songs.length; i++) {
                songs[i] = {
                    artist: songs[i].track.artist,
                    title: songs[i].track.title,
                    album: songs[i].track.album,
                    duration: songs[i].track.durationMillis,
                    id: songs[i].track.nid,
                    service: 'gmusic'
                };
            }
        }

        callback(songs);
    }, function(err) {
        errCallback('error while searching gmusic');
    });
};
gmusicBackend.init = function(callback) {
    gmusicBackend.pm = new PlayMusic();
    gmusicBackend.pm.init(creds, callback);
};
gmusicBackend.middleware = function(req, res, next) {
    next();
};
module.exports = gmusicBackend;