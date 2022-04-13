import { Observable, of, Subject } from "rxjs";
import { Constants } from "./constants";
export class LocalVideoTrack {
    private track: MediaStreamTrack;
    private _player: VideoPlayer;
    private config: any;
    private _onStreamStop: Subject<boolean> = new Subject;
    public kind = Constants.VIDEO;
    public mediaType: string;
    public isActive = true;
    public trackId: string;

    constructor(track: MediaStreamTrack, mediaType, config) {
        this.track = track;
        this.trackId = track.id;
        this.mediaType = mediaType;
        this.config = config || {};
        this.config.elementId = this.config.elementId ? this.config.elementId : 'video-player-'.concat(this.mediaType.toLowerCase());
        this.track.onended = () => { this._onStreamStop.next(true); this.stop(); }
    }

    stop() {
        if (this.track) { this.track.onended = null }
        this.track?.stop();
        this._player?.destroy();
        this._player = null;
        this.track = null;
        this.isActive = false;
    }

    play() {
        if (this.track) {
            this._player ? this._player.updateConfig(this.config, this.track, this.mediaType) : (this._player = new VideoPlayer(this.config, this.track, this.mediaType));
            this._player.play();
        }
    }

    async getCurrentFrameData() {
        return this._player?.getCurrentFrame();
    }

    onStreamStop(): Observable<any> {
        return this._onStreamStop.asObservable();
    }

}


class VideoPlayer {
    private videoElement: HTMLVideoElement;
    private container: HTMLDivElement;
    private trackId: string;
    private slot: HTMLDivElement | HTMLElement;
    private videoTrack: MediaStreamTrack;
    private mediaType: string;
    private config;
    private isSlotPresent: boolean;
    constructor(config, track: MediaStreamTrack, mediaType: string) {
        this.updateConfig(config, track, mediaType);
    }
    updateConfig(config, track: MediaStreamTrack, mediaType) {
        this.destroy();
        const element = document.getElementById(config.elementId);
        if (!element) {
            this.isSlotPresent = false;
            this.slot = document.createElement('div');
            this.slot.id = config.elementId;
            this.slot.style.display = 'none';
            this.slot.style.height = '140px';
            this.slot.style.width = '200px';
            this.slot.style.zIndex = '999';
            this.slot.style.bottom = '10px';
            this.slot.style.right = mediaType === Constants.CAMERA ? '10px' : '220px';
            this.slot.style.position = 'fixed';
            this.slot.style.borderRadius = '10px';
            this.slot.style.boxShadow = '0px 1px 3px 0px #3c40434d, 0px 4px 8px 3px #3c404326';
            document.body.appendChild(this.slot);
        } else {
            while (element.lastElementChild) {
                element.removeChild(element.lastElementChild);
            }
            this.slot = element;
            this.isSlotPresent = true;
        }

        this.config = config;
        this.mediaType = this.mediaType
        this.updateVideoTrack(track)
    }
    updateVideoTrack(track: MediaStreamTrack) {
        this.trackId = track.id;
        this.videoTrack !== track && (this.videoTrack = track, this.createElements());
    }
    play() {
        if (this.videoElement) {
            this.videoElement.play();
        }
    }
    async getCurrentFrame(): Promise<string> {
        try {
            let canvas = document.createElement("canvas");
            let context = canvas.getContext("2d");
            const width = this.videoTrack.getSettings().width;
            const height = this.videoTrack.getSettings().height;
            canvas.width = width;
            canvas.height = height;
            // @ts-ignore: Unreachable code error
            let imageCapture = new ImageCapture(this.videoTrack);
            const imageBitmap: ImageBitmap = await imageCapture.grabFrame();
            context.drawImage(imageBitmap, 0, 0, width, height);
            const url = canvas.toDataURL('image/jpeg', 0.2);
            canvas.remove();
            return Promise.resolve(url)
        } catch (error) {
            console.log(error)
            return Promise.reject(error)
        }
    }
    destroy() {
        if (this.videoElement && (this.videoElement.srcObject = null, this.videoElement = null), this.container) {
            try {
                this.slot.removeChild(this.container)
                if (!this.isSlotPresent) { this.slot.remove(); }
            } catch (a) { }
            this.container = null;
        }
    }
    createElements() {
        this.container || (this.container = document.createElement("div"));
        this.container.id = "video-player-".concat(this.trackId);
        this.container.style.width = "100%";
        this.container.style.height = "100%";
        this.container.style.position = "relative";
        this.container.style.overflow = "hidden";
        this.container.style.borderRadius = '10px';
        this.videoTrack ? (this.container.style.backgroundColor = "black", this.createVideoElement(), this.container.appendChild(this.videoElement)) : this.removeVideoElement();
        this.slot.appendChild(this.container)
    }

    createVideoElement() {
        this.videoElement = this.videoElement || document.createElement('video');
        this.videoElement.id = "video_".concat(this.trackId);
        this.videoElement.srcObject = new MediaStream([this.videoTrack]);
        this.videoElement.autoplay = false;
        this.videoElement.style.width = '100%';
        this.videoElement.style.height = '100%';
        this.container.style.position = "absolute";
        this.videoElement.controls = false;
        this.config.fit ? this.videoElement.style.objectFit = this.config.fit : this.videoElement.style.objectFit = 'cover';
        this.videoElement.play();
    }
    removeVideoElement() {
        if (this.videoElement) {
            try {
                this.container && this.container.removeChild(this.videoElement)
            } catch (a) { }
            this.videoElement = null
        }
    }
}


function transformMediaStream(stream: MediaStream, mediaType, config): LocalVideoTrack {
    const a = [];
    let videoTrack: LocalVideoTrack;
    if (stream.getVideoTracks()[0]) {
        videoTrack = new LocalVideoTrack(stream.getVideoTracks()[0], mediaType, config);
    }
    return videoTrack;
}

export async function getCombinedSnapshot(url1, url2, x = 500, y = 400): Promise<string> {
    try {
        const image1 = new Image();
        image1.src = url1;
        await image1.decode();
        var image2 = new Image;
        image2.src = url2;
        await image2.decode();
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');
        canvas.width = image1.naturalWidth;
        canvas.height = image1.naturalHeight;
        context.drawImage(image1, 0, 0, image1.naturalWidth, image1.naturalHeight);
        context.drawImage(image2, image1.naturalWidth - x, image1.naturalHeight - y, image2.naturalWidth, image2.naturalHeight);
        const url = canvas.toDataURL('image/jpeg', 0.2);
        canvas.remove();
        return Promise.resolve(url);
    } catch (error) {
        return Promise.reject(error);
    }
    return
}



export async function createCameraTrack(config: any = {}): Promise<LocalVideoTrack> {
    config.constraints = config.constraints || {};
    config.constraints = { audio: false, video: true, ...config.constraints };
    return startCapture(config, Constants.CAMERA);
}

export async function createScreenVideoTrack(config: any = {}): Promise<LocalVideoTrack> {
    config.constraints = config.constraints || {};
    config.constraints = {
        video: {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: config.streamId,
                maxWidth: window.screen.width,
                maxHeight: window.screen.height
            }
        },
        ...config.constraints
    }

    return startCapture(config, Constants.SCREEN);
}



export async function createScreenAndCameraTrack(screenConfig = {}, cameraConfig = {}): Promise<LocalVideoTrack[]> {
    let screen: LocalVideoTrack;
    let camera: LocalVideoTrack;
    try {
        screen = await createScreenVideoTrack(screenConfig);
        camera = await createCameraTrack(cameraConfig);
        screen.onStreamStop().subscribe(() => camera.stop());
        camera.onStreamStop().subscribe(() => screen.stop());
        return Promise.resolve([screen, camera]);
    } catch (error) {
        screen?.stop();
        camera?.stop();
        return Promise.reject(error);
    }
}


async function startCapture(config, mediaType): Promise<LocalVideoTrack> {
    if (navigator && navigator.mediaDevices.getUserMedia)
        try {
            const stream = await navigator.mediaDevices.getUserMedia(config.constraints);
            return Promise.resolve(transformMediaStream(stream, mediaType, config))
        } catch (error) {
            return Promise.reject(getMediadevicesError({ error, mediaType }))
        }
    else {
        return Promise.reject({ error: { message: 'getUserMedia not supported' }, mediaType });
    }
}

function getMediadevicesError({ error, mediaType }): any {
    const data = { error, type: mediaType === Constants.CAMERA ? Constants.CAMERA_ACCESS_DENIED : Constants.SCREEN_ACCESS_DENIED, success: false }
    return data;
}