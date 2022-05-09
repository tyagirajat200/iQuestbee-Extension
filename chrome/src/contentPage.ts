import { Subscription, timer } from "rxjs";
import { Constants } from "./constants";
import * as player from "./player";

(() => {

  let screenTrack: player.LocalVideoTrack;
  let cameraTrack: player.LocalVideoTrack;

  document.body.setAttribute('data-cj_ext_installed', chrome.runtime.getManifest().version);

  let backgroundPort: chrome.runtime.Port;
  let backgroundTimer: Subscription;

  connectWithBackground();

  chrome.runtime.onMessage.addListener((message, sender, senderResponse) => {
    switch (message && message.type) {
      case Constants.SCREEN_AND_CAMERA: createTracks(message, senderResponse); break;
      case Constants.CAMERA_RECORD: createTracks(message, senderResponse); break;
      case Constants.SCREEN_RECORD: createTracks(message, senderResponse); break;
      case Constants.CAPTURE_SHOT: takeSnapshot(senderResponse, message); break;
      case Constants.FULLSCREEN_CHANGE: sendMessageToWebpage(message); senderResponse({ success: true }); break;
      case Constants.STOP_PROCTOR: cleanUpScrpit(senderResponse); break;
      case Constants.STOP_CAMERA: destroyCamera(senderResponse); break;
      case Constants.STOP_SCREEN: destroyScreen(senderResponse); break;
      case Constants.CHECK_FOR_CONTENT_SCRIPT: connectWithBackground(); senderResponse({ success: true }); break;
    }
    return true;
  })

  window.addEventListener('message', listenWindowEvents, false);

  function connectWithBackground(msg?): void {
    try {
      if (msg) { console.info(msg) };
      resetBackgroundListeners();
      backgroundPort = chrome.runtime.connect();
      console.info('Connection with background script successfull.');
      // backgroundTimer = timer(4 * 60 * 1000).subscribe(() => connectWithBackground('Disconnect and Reconnect with Background Script'));
      backgroundPort.onDisconnect.addListener(backgroundDisconnect);
    } catch (error) {
      console.error(error);
      window.removeEventListener('message', listenWindowEvents);
      sendMessageToWebpage({ type: Constants.CONNECTION_FAILED });
      cleanUpScrpit();
    }
  }

  function backgroundDisconnect() {
    const time = 500;
    console.info(`background page disconnects,trying to re-connect in ${time}ms...`)
    setTimeout(() => connectWithBackground(), time);
  }


  async function createTracks(message, senderResponse): Promise<void> {
    const type = message ? message.type : null;
    let newScreenTrack: player.LocalVideoTrack;
    let newCameraTrack: player.LocalVideoTrack;
    try {
      if (type === Constants.SCREEN_AND_CAMERA) {
        destroyStreams();
        const [screen, camera] = await player.createScreenAndCameraTrack(message.screen, message.camera); newScreenTrack = screenTrack = screen; newCameraTrack = cameraTrack = camera; camera.play(); screen.play();
      } else if (type === Constants.CAMERA_RECORD) {
        destroyCamera();
        newCameraTrack = cameraTrack = await player.createCameraTrack(message.camera); cameraTrack.play();
      } else if (type === Constants.SCREEN_RECORD) {
        destroyScreen();
        newScreenTrack = screenTrack = await player.createScreenVideoTrack(message.screen); screenTrack.play();
      }
      if (message.addListener !== false) {
        [newCameraTrack, newScreenTrack].forEach(x => x && x.onStreamStop().subscribe(res => sendMessageToWebpage({ success: true, mediaType: x.mediaType, kind: x.kind, type: Constants.STREAM_STOPPED })));
      }
      senderResponse({ success: true, type });
    } catch (error) {
      senderResponse(error);
    }
  }


  function destroyStreams(): void {
    destroyCamera();
    destroyScreen();
  }

  function destroyCamera(senderResponse?): void {
    cameraTrack?.stop();
    cameraTrack = null;
    senderResponse?.({ success: true })
  }
  function destroyScreen(senderResponse?): void {
    screenTrack?.stop();
    screenTrack = null;
    senderResponse?.({ success: true })
  }


  async function takeSnapshot(senderResponse, message) {
    try {
      let dataUrls = [];
      if (cameraTrack?.isActive && screenTrack?.isActive) {
        const data_url1 = await screenTrack.getCurrentFrameData();
        const data_url2 = await cameraTrack.getCurrentFrameData();
        const url = await player.getCombinedSnapshot(data_url1, data_url2, message.x, message.y);
        dataUrls.push({ url, mediaType: Constants.SCREEN });
        dataUrls.push({ url: data_url2, mediaType: Constants.CAMERA });
        senderResponse({ success: true, type: Constants.SNAPSHOT_CAPTURED, dataUrls: dataUrls })
      } else {
        console.error('no MediaStream found to capture');
        senderResponse({ success: false, type: Constants.SNAPSHOT_FAILED })
      }
    } catch (error) {
      console.error(error);
      senderResponse({ success: false, type: Constants.SNAPSHOT_FAILED })
    }
  }


  function listenWindowEvents(event: MessageEvent<any>): void {
    // We only accept messages from ourselves
    if (event.origin != window.location.origin) return;
  }

  function sendMessageToWebpage(data): void {
    window.postMessage(data, window.location.origin);
  }

  function cleanUpScrpit(senderResponse?): void {
    console.log('cleaning up content script...');
    resetBackgroundListeners();
    destroyStreams();
    senderResponse?.({ success: true });
  }


  function resetBackgroundListeners() {
    try {
      backgroundTimer?.unsubscribe();
      backgroundPort?.onDisconnect.removeListener(backgroundDisconnect);
      backgroundPort?.disconnect();
      backgroundTimer = null;
      backgroundPort = null;
    } catch (error) {

    }
  }

})()
