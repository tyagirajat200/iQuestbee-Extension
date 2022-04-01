import { Constants } from "./constants"

let onBoundsChangedListener;

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.clear();
});

chrome.runtime.onConnect.addListener(() => { });

chrome.runtime.onMessageExternal.addListener((message, sender, senderResponse) => {
    switch (message && message.type) {
        case Constants.SCREEN_RECORD: chooseDesktopMedia(message, sender, senderResponse); break;
        case Constants.SCREEN_AND_CAMERA: chooseDesktopMedia(message, sender, senderResponse); break;
        case Constants.CAMERA_RECORD: sendMessageToTab(sender.tab.id, message, senderResponse); break;
        case Constants.CAPTURE_SHOT: sendMessageToTab(sender.tab.id, message, senderResponse); break;
        case Constants.VERSION_INFO: senderResponse(chrome.runtime.getManifest());
        case Constants.CHECK_FOR_CONTENT_SCRIPT: checkForContentScripts(message, sender, senderResponse); break;
        case Constants.INJECT_CONTENT_SCRIPTS: inject_content_scripts(message, sender, senderResponse); break;
        case Constants.CHECK_FOR_UPDATE: checkForUpdate(message, sender, senderResponse); break;
        case Constants.GET_ALL_OPENED_TABS: getAllOpenTabs(message, sender, senderResponse); break;
        case Constants.RELOAD_EXTENSION: reloadExtension(); break;
        case Constants.START_FULLSCREEN: goToFullScreen(message, sender, senderResponse); break;
        case Constants.STOP_PROCTOR: stopProctoringExtension(sender, message, senderResponse); break;
    }
    return true;
})


//listen for and restart on updates (though not if recording in progress)
chrome.runtime.onUpdateAvailable.addListener(evt => {
    chrome.storage.local.get(null, (data) => { if (!(data && data.isCapturing)) reloadExtension(); });
})


function chooseDesktopMedia(message: any, sender: chrome.runtime.MessageSender, senderResponse): void {
    chrome.desktopCapture.chooseDesktopMedia(["screen"], sender.tab, (streamId) => {
        if (streamId && streamId.length) sendMessageToTab(sender.tab.id, { ...message, streamId }, senderResponse);
        else senderResponse({ success: false, type: Constants.SCREEN_ACCESS_DENIED });
    })
}


// if message.canInject is true then it will inject new content script otherwise it will only check  the status
function checkForContentScripts(message, sender: chrome.runtime.MessageSender, senderResponse): void {
    chrome.tabs.sendMessage(sender.tab.id, { type: message.type }, (response) => {
        if (response && response.success) {
            senderResponse({ success: true, type: Constants.CONTENT_SCRIPT_INJECTED });
        }
        else if (message.canInject) inject_content_scripts(message, sender, senderResponse);
        else senderResponse({ success: false, type: Constants.CONTENT_SCRIPT_FAILED })
    });
}

function inject_content_scripts(message, sender: chrome.runtime.MessageSender, senderResponse) {
    chrome.scripting.executeScript({ target: { tabId: sender.tab.id }, files: ['contentPage.js'] }, (injectionResults) => {
        if (injectionResults && injectionResults.length > 0) {
            senderResponse({ success: true, type: Constants.CONTENT_SCRIPT_INJECTED });
        }
        else senderResponse({ success: false, type: Constants.CONTENT_SCRIPT_FAILED });

    })
}


// if message.canUpdate is true then it will update the extension otherwise it will only check for update
function checkForUpdate(message, sender: chrome.runtime.MessageSender, senderResponse): void {
    chrome.runtime.requestUpdateCheck((status, details) => {
        console.log(details, status)
        senderResponse({ details, status });
        if (status === 'update_available' && message.canUpdate) {
            reloadExtension();
        }
    });
}


function reloadExtension(): void {
    chrome.runtime.reload();
}

function goToFullScreen(message: any, sender: chrome.runtime.MessageSender, senderResponse): void {
    chrome.windows.onBoundsChanged.removeListener(onBoundsChangedListener);
    onBoundsChangedListener = onBoundsChanged.bind(null, sender)
    chrome.windows.onBoundsChanged.addListener(onBoundsChangedListener);
    chrome.windows.update(sender.tab.windowId, { state: 'fullscreen', focused: true });
    senderResponse({ success: true })
}


function onBoundsChanged(sender: chrome.runtime.MessageSender, changedWindow: chrome.windows.Window): void {
    chrome.tabs.get(sender.tab.id, (tab) => {
        if (tab) {
            chrome.windows.get(tab.windowId, (window) => {
                if (window && changedWindow.id === window.id) {
                    const message = { type: Constants.FULLSCREEN_CHANGE, state: window.state }
                    sendMessageToTab(sender.tab.id, message);
                }
            })
        } else {
            chrome.windows.onBoundsChanged.removeListener(onBoundsChangedListener);
        }
    })

}



function getAllOpenTabs(message?, sender?: chrome.runtime.MessageSender, senderResponse?): void {
    chrome.tabs.query({}, (result) => {
        const tabs = result.map(tab => { return { url: tab.url, title: tab.title, incognito: tab.incognito, pendingUrl: tab.pendingUrl } })
        senderResponse({ tabs })
    });
}

function sendMessageToTab(tabId: number, message, senderResponse?) {
    chrome.tabs.sendMessage(tabId, message, senderResponse);
}


function setLocalStorage(data): void {
    try {
        if (chrome && chrome.storage && chrome.storage.local)
            chrome.storage.local.set(data);
    } catch (error) {

    }
}

function stopProctoringExtension(sender: chrome.runtime.MessageSender, message, senderResponse) {
    sendMessageToTab(sender.tab.id, message, senderResponse)
    chrome.windows.onBoundsChanged.removeListener(onBoundsChangedListener);
    onBoundsChangedListener = null;
}
