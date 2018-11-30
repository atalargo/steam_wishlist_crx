let steamId = document.getElementById('steamId');
let inputSteamId = document.getElementById('inputSteamId');
let btValidSteamId = document.getElementById('validSteamId');
let savedSteamId = null;

function inputchange () {
    if (inputSteamId.value.length < 4) {
        btValidSteamId.setAttribute('disabled', 1);
    } else {
        btValidSteamId.removeAttribute('disabled');
    }
}

inputSteamId.addEventListener('keydown', inputchange);
inputSteamId.addEventListener('change', inputchange);

function restoreOptions () {
    chrome.storage.local.get(['steamId'], function (result) {
        if (result && result.steamId) {
            steamId.innerText = result.steamId;
            savedSteamId = result.steamId;
            inputSteamId.value = '';
        }
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
btValidSteamId.addEventListener('click', function () {
    chrome.storage.local.set({'steamId': inputSteamId.value}, function (result) {
        restoreOptions();
    });
});
