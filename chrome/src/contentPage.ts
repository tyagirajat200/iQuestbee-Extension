import { Constants } from "./constants";

(() => {

  let streams: MediaStream[] = [];

  document.body.setAttribute('data-cj_ext_installed', chrome.runtime.getManifest().version);

  let portWithBackground;

  connectWithBackground();

  chrome.runtime.onMessage.addListener((message, sender, senderResponse) => {
    switch (message && message.type) {
      case Constants.SCREEN_AND_CAMERA: startCameraCapture(message, senderResponse, true); break;
      case Constants.CAMERA_RECORD: startCameraCapture(message, senderResponse); break;
      case Constants.SCREEN_RECORD: startScreenCapture(message, senderResponse); break;
      case Constants.CAPTURE_SHOT: takeSnapshot(senderResponse); break;
      case Constants.FULLSCREEN_CHANGE: sendMessageToWebpage(message); break;
      case Constants.STOP_PROCTOR: cleanUpScrpit(senderResponse); break;
      case Constants.CHECK_FOR_CONTENT_SCRIPT: senderResponse({ success: true }); break;
    }
    return true;
  })

  window.addEventListener('message', listenWindowEvents, false);

  function connectWithBackground(): void {
    try {
      portWithBackground = chrome.runtime.connect();
      portWithBackground.onDisconnect.addListener(() => {
        console.log('background page disconnects,trying to re-connect')
        setTimeout(() => connectWithBackground(), 5000);
      });
    } catch (error) {
      console.error(error);
      window.removeEventListener('message', listenWindowEvents);
      sendMessageToWebpage({ type: Constants.CONNECTION_FAILED });
      cleanUpScrpit();
    }
  }

  async function startCameraCapture(message, senderResponse, isRecordScreen?: boolean): Promise<void> {
    const constraints = { audio: false, video: true };
    try {
      const camera = await startCapture(constraints);
      camera['mediaType'] = Constants.CAMERA;
      camera['width'] = camera.getVideoTracks()[0].getSettings().width;
      camera['height'] = camera.getVideoTracks()[0].getSettings().height;
      camera['fullcanvas'] = true;
      streams.push(camera);
      startVideoPlay(camera);
      if (isRecordScreen) {
        console.log('camera captured...');
        startScreenCapture(message, senderResponse, true);
      } else {
        addStreamStopListener(camera, () => destroyStreams());
        senderResponse({ success: true, type: Constants.CAMERA_CAPTURED });
        console.log('camera captured...');
      }
    } catch (error) {
      console.error(error)
      senderResponse({ success: false, type: Constants.CAMERA_ACCESS_DENIED })
    }
  }

  async function startScreenCapture(message, senderResponse, isAfterCameraCapture?: boolean): Promise<void> {
    const constraints: any = {
      video: {
        mandatory: {
          chromeMediaSource: 'desktop', chromeMediaSourceId: message.streamId,
          maxWidth: window.screen.width,
          maxHeight: window.screen.height
        }
      }
    }
    try {
      const screen = await startCapture(constraints);
      screen['mediaType'] = Constants.SCREEN;
      screen['width'] = window.screen.width;
      screen['height'] = window.screen.height;
      screen['fullcanvas'] = true;
      streams.push(screen);
      startVideoPlay(screen);
      addStreamStopListener(screen, () => destroyStreams());
      senderResponse({ success: true, type: Constants.SCREEN_CAPTURED });
      console.log('screen captured...');
    } catch (error) {
      console.error(error)
      senderResponse({ success: false, type: Constants.SCREEN_ACCESS_DENIED })
    }
  }

  function startCapture(constraints): Promise<MediaStream> {
    return new Promise((resolve, reject) => {
      if (navigator && navigator.mediaDevices.getUserMedia && navigator.mediaDevices.getUserMedia)
        navigator.mediaDevices.getUserMedia(constraints).then(resolve).catch(reject);
      else {
        reject('mediaDevices not supported');
      }
    })
  }

  function addStreamStopListener(stream: MediaStream, callback) {
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.addEventListener('ended', callback, false);
      });
    }
  }


  function destroyStreams() {
    streams.forEach(stream => stream.getTracks().forEach(track => track.stop()));
    streams = [];
    destroyVideoElements();
    sendMessageToWebpage({ success: true, type: Constants.STREAM_STOPPED });
  }


  async function takeSnapshot(senderResponse) {
    if (streams && streams.length > 0) {
      try {
        const dataUrls = [];
        // canvas for screen
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = streams[1]['width'];
        canvas.height = streams[1]['height'];
        const track1 = streams[1].getVideoTracks()[0];
        // @ts-ignore: Unreachable code error
        let imageCapture1 = new ImageCapture(track1);
        const imageBitmap1 = await imageCapture1.grabFrame();
        context.drawImage(imageBitmap1, 0, 0, streams[1]['width'], streams[1]['height']);

        // canvas for user video
        const canvas_user = document.createElement('canvas');
        const context_user = canvas_user.getContext('2d');
        canvas_user.width = streams[0]['width'];
        canvas_user.height = streams[0]['height'];
        const track2 = streams[0].getVideoTracks()[0];
        // @ts-ignore: Unreachable code error
        let imageCapture2 = new ImageCapture(track2);
        const imageBitmap2 = await imageCapture2.grabFrame();
        context.drawImage(imageBitmap2, streams[1]['width'] - 500, streams[1]['height'] - 400, streams[0]['width'], streams[0]['height']);
        context_user.drawImage(imageBitmap2, 0, 0, streams[0]['width'], streams[0]['height']);

        const screenUrl = await canvas.toDataURL('image/jpeg', 0.2);
        dataUrls.push({ url: screenUrl, mediaType: Constants.SCREEN });
        const userUrl = await canvas_user.toDataURL('image/jpeg', 0.2);
        dataUrls.push({ url: userUrl, mediaType: Constants.CAMERA });
        senderResponse({ success: true, type: Constants.SNAPSHOT_CAPTURED, dataUrls: dataUrls })
      } catch (error) {
        console.error(error)
        senderResponse({ success: false, type: Constants.SNAPSHOT_FAILED })
      }
    } else {
      console.log('no MediaStream found to capture');
      senderResponse({ success: false, type: Constants.SNAPSHOT_FAILED })
    }
  }


  function startVideoPlay(stream: MediaStream): void {
    const element = document.createElement('video');
    element.id = `${stream['mediaType']}_EXT_VIDEO`
    element.srcObject = stream;
    element.autoplay = false;
    element.style.display = 'none';
    document.body.appendChild(element);
  }


  function destroyVideoElements(): void {
    const id = ['CAMERA_EXT_VIDEO', 'SCREEN_EXT_VIDEO']
    for (let index = 0; index < 2; index++) {
      const element = document.getElementById(id[index]);
      if (element) element.remove();
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
    destroyStreams();
    if (senderResponse) {
      senderResponse({ success: true })
    }
  }

})()
