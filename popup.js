let crawlSW = document.getElementById('startCrawl');
let loader = document.getElementById('loader');
let lastResume = document.getElementById('resume');
let getCSVLast = document.getElementById('getCSVLast');
let steamId = document.getElementById('steamId');
let savedSteamId = null;

function run () {
    loader.className = '';
    if (!crawlSW.hasAttribute('disabled')) {
        crawlSW.setAttribute('disabled', 1);
    }
}
function stop () {
    loader.className = 'hidden';
    if (crawlSW.hasAttribute('disabled')) {
        crawlSW.removeAttribute('disabled');
    }
    refresh();
}
crawlSW.onclick = function (event) {
    chrome.storage.local.get(['crawlRunning'], function (result) {
        console.debug(result);
        if (!result || !result.crawlRunning) {
            run();
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                let tab = tabs[0];
                chrome.runtime.sendMessage({runCrawl: tab.id, url: tab.url, steamId: savedSteamId}, function(response) {
                    stop();
                    console.debug("crawl ended!");
                    console.debug('response is ', response);
                });
            });
        } else {
            console.debug('Crawl already running!');
        }
    })
};

let clearBt = document.getElementById('clearBt');
clearBt.onclick = function (ev) {
    chrome.storage.local.set({crawlRunning: false}, function () {
        alert('Storage cleared');
        stop();
    });
};

document.getElementById('optionPage').addEventListener('click', function (e) {
    e.stopPropagation();
    e.preventDefault();
    chrome.runtime.openOptionsPage();
});

function refresh () {
    chrome.storage.local.get(['crawlRunning', 'dataall', 'endtime', 'lastdate'], function (result) {
        if (result) {
            if (result.crawlRunning) {
                run();
            }
            if (result.lastdate) {
                document.getElementById('lastdate').innerText = result.lastdate;
                document.getElementById('endtime').innerText = result.endtime;
                var url = window.URL || window.webkitURL || window.mozURL || window.msURL;

                getCSVLast.download = 'SteamAllWishlist.csv';
                getCSVLast.href = url.createObjectURL(new Blob([result.dataall], {type: 'text/csv'}));
                getCSVLast.dataset.downloadurl = ['csv', getCSVLast.download, getCSVLast.href].join(':');
                lastResume.className = '';
                console.debug(result.dataall);
            } else {
                lastResume.className = 'hidden';
            }
        }
    });
}
function testSteamId () {
    chrome.storage.local.get(['steamId'], function (result) {
        if (result && result.steamId) {
            savedSteamId = result.steamId;
            steamId.innerText = result.steamId;
            crawlSW.removeAttribute('disabled');
            clearBt.removeAttribute('disabled');
            refresh();
        } else {
            savedSteamId = null;
            steamId.innerText = '';
            crawlSW.setAttribute('disabled', 1);
            clearBt.setAttribute('disabled', 1);
        }
    });
}
testSteamId();
