let sendPeer: RTCPeerConnection;
let receivePeer: RTCPeerConnection;

let localVideo: HTMLVideoElement;
let remoteVideo: HTMLVideoElement;
let localStream: MediaStream;

let startButton: HTMLButtonElement;
let callButton: HTMLButtonElement;
let stopButton: HTMLButtonElement;

const offerOptions: RTCOfferOptions = {
  offerToReceiveVideo: true,
  offerToReceiveAudio: false,
};

export function setup() {
  localVideo = document.getElementById("localVideo") as HTMLVideoElement;
  remoteVideo = document.getElementById("remoteVideo") as HTMLVideoElement;

  startButton = document.getElementById("start") as HTMLButtonElement;
  callButton = document.getElementById("call") as HTMLButtonElement;
  stopButton = document.getElementById("stop") as HTMLButtonElement;
  callButton.disabled = true;
  stopButton.disabled = true;
  startButton.addEventListener("click", startRecording);
  callButton.addEventListener("click", call);
  stopButton.addEventListener("click", stopRecording);
}

async function startRecording() {
  console.log("Requesting local stream");
  startButton.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
    console.log("Received local stream");
    localVideo.srcObject = stream;
    localStream = stream;
    callButton.disabled = false;
  } catch (e) {
    console.error("Error accessing media devices.", e);
  }
}

async function call() {
  callButton.disabled = true;
  stopButton.disabled = false;
  console.log("Starting call");
  const videoTrack = localStream.getVideoTracks()[0];
  const configuration: RTCConfiguration = {};
  sendPeer = new RTCPeerConnection(configuration);
  sendPeer.addEventListener("icecandidate", (e) => onIceCandidate(sendPeer, e));
  receivePeer = new RTCPeerConnection(configuration);
  receivePeer.addEventListener("icecandidate", (e) =>
    onIceCandidate(receivePeer, e),
  );
  sendPeer.addEventListener("iceconnectionstatechange", (e) =>
    onIceStateChange(sendPeer, e),
  );
  receivePeer.addEventListener("iceconnectionstatechange", (e) =>
    onIceStateChange(receivePeer, e),
  );
  receivePeer.addEventListener("track", (e) => {
    console.log("Received remote stream");
    remoteVideo.srcObject = e.streams[0];
  });
  sendPeer.addTrack(videoTrack, localStream);

  try {
    console.log("Creating offer");
    const offer = await sendPeer.createOffer(offerOptions);
    await onCreateOfferSuccess(offer);
  } catch (e) {
    onCreateSessionDescriptionError(e);
  }
}

async function stopRecording() {}

function getPartner(peer: RTCPeerConnection) {
  return peer === sendPeer ? receivePeer : sendPeer;
}

async function onIceCandidate(
  peer: RTCPeerConnection,
  event: RTCPeerConnectionIceEvent,
) {
  try {
    await getPartner(peer).addIceCandidate(event.candidate);
    onAddIceCandidateSuccess(peer);
  } catch (e) {
    onAddIceCandidateError(peer, e);
  }
}

function onAddIceCandidateSuccess(peer: RTCPeerConnection) {
  console.log(`${peer} addIceCandidate success`);
}

function onAddIceCandidateError(peer: RTCPeerConnection, error: any) {
  console.error(`${peer} failed to add ICE candidate: ${error}`);
}

function onIceStateChange(peer: RTCPeerConnection, event: Event) {
  if (peer) {
    console.log(`${peer} ICE state: ${peer.iceConnectionState}`);
    console.log("ICE state change event: ", event);
  }
}

function onCreateSessionDescriptionError(error: any) {
  console.error(`Failed to create session description: ${error.toString()}`);
}

async function onCreateOfferSuccess(offer: RTCSessionDescriptionInit) {
  try {
    await sendPeer.setLocalDescription(offer);
    console.log("setLocalDescription success");
  } catch (e) {
    console.error(`Failed to set session description: ${e}`);
  }

  try {
    await receivePeer.setRemoteDescription(offer);
    console.log("setRemoteDescription success");
  } catch (e) {
    console.error(`Failed to set session description: ${e}`);
  }

  try {
    const answer = await receivePeer.createAnswer();
    await onCreateAnswerSuccess(answer);
  } catch (e) {
    console.error(`Failed to answer: ${e}`);
  }
}

async function onCreateAnswerSuccess(answer: RTCSessionDescriptionInit) {
  try {
    await receivePeer.setLocalDescription(answer);
    console.log("setLocalDescription success");
  } catch (e) {
    console.error(`Failed to set session description: ${e}`);
  }

  try {
    await sendPeer.setRemoteDescription(answer);
    console.log("setRemoteDescription success");
  } catch (e) {
    console.error(`Failed to set session description: ${e}`);
  }
}
