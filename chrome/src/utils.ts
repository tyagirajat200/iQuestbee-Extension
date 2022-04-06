

export async function createCameraTrack(config = {}): Promise<MediaStream> {
    const constraints = { audio: false, video: true, ...config };
    return startCapture(constraints);
}

export async function createMicrophoneTrack(config = {}): Promise<MediaStream> {
    const constraints = { audio: true, video: false, ...config };
    return startCapture(constraints);
}

export async function createCameraAndMicrophoneTrack(config = {}): Promise<MediaStream> {
    const constraints = { audio: true, video: true, ...config };
    return startCapture(constraints);
}

export async function createScreenVideoTrack(config: any = {}): Promise<MediaStream> {
    const constraints = {
        video: {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: config.chromeMediaSourceId,
                maxWidth: window.screen.width,
                maxHeight: window.screen.height
            }
        }
    }
    return startCapture(constraints);
}

async function startCapture(constraints): Promise<MediaStream> {
    if (navigator && navigator.mediaDevices.getUserMedia)
        try {
            const stream = navigator.mediaDevices.getUserMedia(constraints);
            return Promise.resolve(stream)
        } catch (error) {
            return Promise.reject(error)
        }
    else {
        return Promise.reject('getUserMedia not supported');
    }
}
