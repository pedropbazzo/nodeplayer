var bodyParser = require('body-parser');
var _ = require('underscore');
var url = require('url');
var send = require('send');

var rest = {};
var config, player;

var sendResponse = function(res, msg, err) {
    if(err)
        res.status(404).send(err);
    else
        res.send(msg);
};

// called when nodeplayer is started to initialize the backend
// do any necessary initialization here
rest.init = function(_player, callback, errCallback) {
    player = _player;
    config = _player.config;

    if(!player.expressApp) {
        errCallback('module must be initialized after expressjs module!');
    } else {
        player.expressApp.get('/queue', function(req, res) {
            res.send(JSON.stringify(player.queue));
        });

        // TODO: support pos
        // TODO: get rid of the partyplay specific userID here
        // queue song
        player.expressApp.post('/queue', bodyParser.json({limit: '100mb'}), function(req, res) {
            var err = player.addToQueue(req.body.songs, req.body.pos, {
                userID: req.body.userID
            });
            sendResponse(res, 'success', err);
        });

        player.expressApp.delete('/queue/:pos', bodyParser.json({limit: '100mb'}), function(req, res) {
            var err = player.removeFromQueue(req.params.pos, req.body.cnt);
            sendResponse(res, 'success', err);
        });

        // TODO: maybe this functionality should be moved into index.js?
        player.expressApp.post('/playctl', bodyParser.json({limit: '100mb'}), function(req, res) {
            var action = req.body.action;
            var cnt = req.body.cnt;

            if(action === 'play') {
                startPlayback(req.body.position);
            } else if(action === 'pause') {
                pausePlayback();
            } else if(action === 'skip') {
                player.npIsPlaying = false;

                for(var i = 0; i < Math.abs(req.body.cnt); i++) {
                    if(cnt > 0) {
                        if(player.queue[0])
                            player.playedQueue.push(player.queue[0]);

                        player.queue.shift();
                    } else if(cnt < 0) {
                        if(player.playedQueue.length)
                            player.queue.unshift(player.playedQueue.pop());
                    }

                    // ran out of songs while skipping, stop
                    if(!player.queue[0])
                        break;
                }

                clearTimeout(player.songEndTimeout);
                player.songEndTimeout = null;
                player.onQueueModify();
            } else if(action === 'shuffle') {
                // don't change now playing
                var temp = player.queue.shift();
                player.queue = _.shuffle(player.queue);
                player.queue.unshift(temp);

                player.onQueueModify();
            }

            res.send('success');
        });

        // search for song with given search terms
        player.expressApp.post('/search', bodyParser.json({limit: '100mb'}), function(req, res) {
            console.log('got search request: ' + req.body.terms);

            var resultCnt = 0;
            var allResults = {};

            _.each(player.backends, function(backend) {
                backend.search(req.body, function(results) {
                    resultCnt++;

                    // make a temporary copy of songlist, clear songlist, check
                    // each song and add them again if they are ok
                    var tempSongs = _.clone(results.songs);
                    allResults[backend.name] = results;
                    allResults[backend.name].songs = {};

                    _.each(tempSongs, function(song) {
                        var err = player.callHooks('preAddSearchResult', [player, song]);
                        if(!err)
                            allResults[backend.name].songs[song.songID] = song;
                    });

                    // got results from all services?
                    if(resultCnt >= Object.keys(player.backends).length)
                        res.send(JSON.stringify(allResults));
                }, function(err) {
                    resultCnt++;
                    console.log(err);

                    // got results from all services?
                    if(resultCnt >= Object.keys(player.backends).length)
                        res.send(JSON.stringify(allResults));
                });
            });
        });

        // so other modules can easily see that this module is loaded
        player.rest = true;

        callback();
    }
};

rest.onBackendInit = function(playerState, backend) {
    // expressjs middleware for requesting music data
    // must support ranges in the req, and send the data to res
    player.expressApp.use('/song/' + backend.name, function(req, res, next) {
        send(req, url.parse(req.url).pathname, {
            dotfiles: 'allow',
            root: config.songCachePath + '/' + backend.name
        }).pipe(res);
    });
};

module.exports = rest;
