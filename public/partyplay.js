var searchResults = [];

var search = function() {
    var searchTerms = $("#search-terms").val();

    $.ajax('/search/' + searchTerms).done(function(data) {
        searchResults = JSON.parse(data);
        $("#search-results").empty();

        for (var i = 0; i < searchResults.length; i++) {
            $.tmpl( "searchTemplate", {
                title: searchResults[i].title,
                artist: searchResults[i].artist,
                duration: searchResults[i].duration,
                searchID: i
            }).appendTo("#search-results");
        }
    });
};

var vote = function(id, vote) {
    var upArrow = $("#uparrow" + id);
    var downArrow = $("#downarrow" + id);
    if(vote > 0) {
        // is already upvoted: remove upvote
        if(upArrow.hasClass("active")) {
            $("#uparrow" + id).removeClass("active");
            vote = 0;
        // upvote
        } else {
            $("#uparrow" + id).addClass("active");
        }
        $("#downarrow" + id).removeClass("active");
    } else if(vote < 0) {
        // is already downvoted: remove downvote
        if(downArrow.hasClass("active")) {
            $("#downarrow" + id).removeClass("active");
            vote = 0;
        // downvote
        } else {
            $("#downarrow" + id).addClass("active");
        }
        $("#uparrow" + id).removeClass("active");
    }

    $.ajax({
        type: 'POST',
        url: '/vote/' + id,
        data: JSON.stringify({
            vote: vote,
            userID: $.cookie('userID')
        }),
        contentType: 'application/json',
        dataType: 'json'
    });
};

var appendQueue = function(searchID) {
    $.ajax({
        type: 'POST',
        url: '/queue',
        data: JSON.stringify({
            song: searchResults[searchID],
            userID: $.cookie('userID')
        }),
        contentType: 'application/json',
        success: updateQueue
    });

    $("#search-results").empty();
};

var updateQueue = function() {
    console.log('updating');
    $.ajax('/queue').done(function(data) {
        var newQueue = JSON.parse(data);
        $("#queue").empty();

        // now playing
        if(newQueue.length)
            $.tmpl( "nowPlayingTemplate", newQueue[0]).appendTo("#queue");

        // rest of queue
        for(var i = 1; i < newQueue.length; i++) {
            $.tmpl( "queueTemplate", newQueue[i]).appendTo("#queue");
        }

        var userID = $.cookie('userID');
        // update votes
        for(var i = 0; i < newQueue.length; i++) {
            if(newQueue[i].upVotes[userID]) {
                $("#uparrow" + newQueue[i].id).addClass("active");
            } else if(newQueue[i].downVotes[userID]) {
                $("#downarrow" + newQueue[i].id).addClass("active");
            }
        }
    });
};

$(document).ready(function() {
    // generate a user ID if there is not one yet
    if(!$.cookie('userID')) {
        var s4 = function() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }
        var guid = s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                s4() + '-' + s4() + s4() + s4();
        $.cookie('userID', guid);
    }

    var nowPlayingMarkup = '<li class="list-group-item now-playing" id="${id}">'
        + '<div class="arrows">'
        + '<div class="uparrow">'
        + '<span class="glyphicon glyphicon-thumbs-up" id="uparrow${id}" onclick="vote(\'${id}\', 1);"></span>'
        + '</div>'
        + '<div class="downarrow">'
        + '<span class="glyphicon glyphicon-thumbs-down" id="downarrow${id}" onclick="vote(\'${id}\', -1);"></span>'
        + '</div>'
        + '</div>'
        + '<div class="title">${title}</div>'
        + '<div class="artist">${artist}</div>'
        + '</li>';

    $.template( "nowPlayingTemplate", nowPlayingMarkup );

    var queueMarkup = '<li class="list-group-item" id="${id}">'
        + '<div class="arrows">'
        + '<div class="uparrow">'
        + '<span class="glyphicon glyphicon-thumbs-up" id="uparrow${id}" onclick="vote(\'${id}\', 1);"></span>'
        + '</div>'
        + '<div class="downarrow">'
        + '<span class="glyphicon glyphicon-thumbs-down" id="downarrow${id}" onclick="vote(\'${id}\', -1);"></span>'
        + '</div>'
        + '</div>'
        + '<div class="title">${title}</div>'
        + '<div class="artist">${artist}</div>'
        + '</li>';

    $.template( "queueTemplate", queueMarkup );

    var searchResultMarkup = '<li class="list-group-item searchResult" id="${id}" onclick="appendQueue(${searchID})">'
        + '<div class="title">${title}</div>'
        + '<div class="artist">${artist}</div>'
        + '</li>';

    $.template( "searchTemplate", searchResultMarkup );

    $("#search-terms").keyup(function(e) {
        if(e.keyCode === 13)
            search();
    });

    updateQueue();
    setInterval(updateQueue, 5000);
});