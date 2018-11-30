'use strict';

chrome.runtime.onInstalled.addListener(function() {
    console.debug('Installed');
});
chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
    // With a new rule ...
    chrome.declarativeContent.onPageChanged.addRules([
        {
            // That fires when a page's URL contains a 'g' ...
            conditions: [
                new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: { hostEquals: 'partner.steamgames.com', schemes: ['https'] },
                    css: ['#appHeaderFindInput']
                })
            ],
            // And shows the extension's page action.
            actions: [ new chrome.declarativeContent.ShowPageAction() ]
        }
    ]);
});
var runningDownloadItems = {};
var downloadedItems = {};
var globalCounter = 0;
var currentDay = null;
var onFinish = false;
var sqlPrepare = {};
var srTooltip;
window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
function clearDownload(downloadId) {
    delete downloadedItems[downloadId];
    console.debug('clear download #' + downloadId + ' . ' + Object.keys(downloadedItems).length + ' left.');
    if (Object.keys(downloadedItems).length === 0) {
        console.debug('Merge CSV to SQL... (file: all_wishlist_' + currentDay + '.sql)', Object.keys(sqlPrepare));
        // SteamAppId,DateLocal,Game,Adds,Deletes,PurchasesAndActivations,Gifts
         // let sql = 'COPY <table> (app_id, date, name, adds, deletes, gifts, records, pu_and_acts) FROM '
         let sqlcsvall = "SteamAppId,DateLocal,Game,Adds,Deletes,PurchasesAndActivations,Gifts\n";
         Object.keys(sqlPrepare).forEach(function (appId) {
             sqlcsvall += sqlPrepare[appId];
             sqlcsvall += "\n";
         })
         chrome.storage.local.set({lastdate: currentDay, endtime: (new Date()).toUTCString(), dataall: sqlcsvall}, function() {
             chrome.storage.local.set({crawlRunning: false}, function () {
                 console.debug('crawl and Parse ended in back!');
             });
             if (srTooltip) {
                 srTooltip({r: true});
             }
         });
    }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadAllFinish () {
    if (onFinish) {
        return;
    }
    onFinish = true;

    await sleep(10000); // wait io file finished
    Object.keys(downloadedItems).forEach(function (dID) {
        dID = parseInt(dID);
        chrome.downloads.search({id: dID}, function (items) {
            if (items.length === 0) {
                console.debug('CSV file not found for app #' + downloadedItems[dID]);
                clearDownload(dID);
                return;
            } else {
                let errorHandler = function (type) {
                    return function (err) {
                        console.error(err, type + ' for app #' + downloadedItems[dID], items[0].filename);
                        clearDownload(dID);
                    };
                };
                let xhr = new XMLHttpRequest();
                 xhr.onreadystatechange = function () {
                     if (this.readyState == 4) {
                         let resp = this.response;
                         let ctl = 0;
                         let appId = downloadedItems[dID];
                         let prepared = [];
                         resp.split("\n").forEach(function (line) {
                             if (ctl > 3) {
                                 if (line.length > 1) {
                                     prepared.push(appId + ',' + line);
                                 }
                             }
                             ctl++;
                         });
                         sqlPrepare[appId] = prepared.join("\n");
                         console.debug('SQL PREPARED '+appId + ' entries: ' + (ctl - 4))
                         clearDownload(dID);
                     }
                 };
                 xhr.open('GET', "file://" + items[0].filename);
                 xhr.responseType = 'text';
                 xhr.send();
            }
        });
    });
}

chrome.downloads.onChanged.addListener(function (downloadDelta) {
    // https://developer.chrome.com/extensions/downloads#event-onChanged
    if (runningDownloadItems[downloadDelta.id]) {
        // is one of the CSV downloaded
        if (downloadDelta.state && downloadDelta.state.current == 'complete' && downloadDelta.state.previous !== 'complete') {
            // OK csv downloaded completely
            downloadedItems[downloadDelta.id] = runningDownloadItems[downloadDelta.id];
            delete runningDownloadItems[downloadDelta.id];
            globalCounter--;
            if (globalCounter <= 0) {
                // merge csv for SQL;
                downloadAllFinish();
            }
        }
    }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.runCrawl) {
        chrome.storage.local.set({crawlRunning: true}, function () {
            let listPageUrl = 'https://partner.steamgames.com/pub/apps/' + request.steamId;
            var f = function(msg) {
                if (!msg.appids) {
                    console.debug("Content script received: ", msg);
                } else {
                    console.debug(msg.appids);
                    globalCounter = msg.appids.length;
                    onFinish = false;
                    console.debug('received appids: ' + globalCounter);
                    currentDay = (new Date()).toJSON().replace(/T.*$/,'');
                    // AWS.config.region = 'us-east-1';
                    // bucket.config.credentials = new AWS.WebIdentityCredentials({
                    //     ProviderId: 'graph.facebook.com',
                    //     RoleArn: roleArn,
                    //     WebIdentityToken: response.authResponse.accessToken
                    // });
                    // let bucket = new AWS.S3({
                    //     params: {
                    //         Bucket: 'dow-development'
                    //     }
                    // });
                    srTooltip = sendResponse;
                    msg.appids.forEach(function (appId) {
                        console.debug('go getCSV for appId: ' + appId);
                        let url = 'https://partner.steampowered.com/report_csv.php?file=SteamWishlists_' + appId + '_2000-01-01_to_' + currentDay+ '&params=query=QueryWishlistActionsForCSV^appID=' + appId + '^dateStart=2000-01-01^dateEnd=' + currentDay+ '^interpreter=WishlistReportInterpreter';
                        chrome.downloads.download({
                            url: url,
                            filename: 'SteamWishlistsTmp/SteamWishlists_' + appId + '.csv',
                            conflictAction: 'overwrite',

                        }, function (downloadId) {
                            runningDownloadItems[downloadId] = appId;
                            console.debug('Start download #' + downloadId + 'for ' + appId);
                                            // let params = {
                                            //     Key: 'SteamWishlists/SteamWishlists_' + appId + '.csv',
                                            //     ContentType:' application/csv',
                                            //     file: items.filename,
                                            //     ACL: 'public-read'
                                            // };
                                            // bucket.putObject(params, function (err, data) {
                                            //     if (err) {
                                            //         console.error('ERROR S2 for '+appId+ ' : ' + err);
                                            //     } else {
                                            //         console.debug('OK for ' + appId);
                                            //     }
                                            //     checkFinish();
                                            // });

                                            // let params = {
                                            //     Key: 'SteamWishlists/SteamWishlists_' + appId + '.csv',
                                            //     ContentType:' application/csv',
                                            //     file: items.filename,
                                            //     ACL: 'public-read'
                                            // };
                                            // bucket.putObject(params, function (err, data) {
                                            //     if (err) {
                                            //         console.error('ERROR S2 for '+appId+ ' : ' + err);
                                            //     } else {
                                            //         console.debug('OK for ' + appId);
                                            //     }
                                            //     checkFinish();
                                            // });
                        });
                    });
                }
              };
              chrome.extension.onMessage.addListener(f);
              chrome.extension.onConnect.addListener(function (port) {
                  console.debug('onConnect', port);
                  port.postMessage({back: 'HelloToo'});
              });

              var parseAndDownload = function () {
                  console.debug('parseAndDownload');
                  chrome.tabs.executeScript(request.runCrawl, {
                     file: 'crawl.js'
                  });
              };
              if (request.url !== listPageUrl) {
                  let cb = null;
                  cb = function (details) {
                      console.debug(details);
                      chrome.tabs.onUpdated.removeListener(cb);
                      console.debug("loaded");
                      parseAndDownload();
                  };
                  chrome.tabs.onUpdated.addListener(cb);
                  chrome.tabs.update(request.runCrawl, {
                      url: listPageUrl
                  });
              } else {
                  parseAndDownload();
              }
          });
      }

      return true;
});
