let peerConnection: RTCPeerConnection;

let localVideo: HTMLVideoElement;
let remoteVideo: HTMLVideoElement;
let localStream: MediaStream;

let connectButton: HTMLButtonElement;
let captureButton: HTMLButtonElement;
let stopButton: HTMLButtonElement;

let ws: WebSocket;

let queue: Array<any> = [];

const offerOptions: RTCOfferOptions = {
  offerToReceiveVideo: true,
  offerToReceiveAudio: false,
};

const peerConnectionConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export function setup() {
  localVideo = document.getElementById("localVideo") as HTMLVideoElement;
  remoteVideo = document.getElementById("remoteVideo") as HTMLVideoElement;

  connectButton = document.getElementById("connect") as HTMLButtonElement;
  captureButton = document.getElementById("capture") as HTMLButtonElement;
  stopButton = document.getElementById("stop") as HTMLButtonElement;
  captureButton.disabled = true;
  stopButton.disabled = true;
  captureButton.addEventListener("click", capture);
  connectButton.addEventListener("click", connect);
  stopButton.addEventListener("click", disconnect);
}

async function connect() {
  console.log("Starting connection");
  ws = new WebSocket("ws://localhost:4000/socket");
  ws.onopen = () => {
    console.log("Connected to server");
  };
  ws.close = () => {
    console.log("Disconnected from server");
  };
  ws.onmessage = messageHandler;
  setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ action: "Ping" }));
    }
  }, 5000);

  connectButton.disabled = true;
  captureButton.disabled = false;
  stopButton.disabled = false;
}

async function capture() {
  console.log("Requesting local stream");
  captureButton.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
    console.log("Received local stream");
    localVideo.srcObject = stream;
    localStream = stream;
    ws.send(JSON.stringify({ action: "Open" }));
  } catch (e) {
    console.error("Error accessing media devices.", e);
  }
}

async function disconnect() {
  console.log("Stopping");
  close();
}

function close() {
  ws.send(JSON.stringify({ action: "Close" }));
  peerConnection?.close();
  localStream?.getTracks().forEach((track) => track.stop());
  ws.close();
  stopButton.disabled = true;
  captureButton.disabled = true;
  connectButton.disabled = false;
}

function startPeerConnection(offerType: "offer" | "answer") {
  connectButton.disabled = true;
  captureButton.disabled = true;
  stopButton.disabled = false;
  queue = new Array();
  peerConnection = new RTCPeerConnection(peerConnectionConfig);
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(
        JSON.stringify({
          action: "Ice",
          candidate: event.candidate,
        }),
      );
    }
  };
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });
  }
  peerConnection.ontrack = (event) => {
    console.log("Received remote stream");
    remoteVideo.srcObject = event.streams[0];
  };
  if (offerType === "offer") {
    peerConnection
      .createOffer(offerOptions)
      .then(setDescription)
      .catch((err) => console.error("Error creating offer: ", err));
  }
}

function setDescription(description: RTCSessionDescriptionInit) {
  peerConnection
    .setLocalDescription(description)
    .then(() => {
      ws.send(
        JSON.stringify({
          action: "Sdp",
          sdp: description,
        }),
      );
    })
    .catch((err) => console.error("Error setting local description: ", err));
}

function messageHandler(event: MessageEvent) {
  console.debug("Received message: ", event.data);
  const message = JSON.parse(event.data);
  switch (message.action) {
    case "Offer":
      startPeerConnection("offer");
      return;
    case "Answer":
      startPeerConnection("answer");
      return;
    case "Ice":
      if (peerConnection.remoteDescription) {
        peerConnection
          .addIceCandidate(new RTCIceCandidate(message.candidate))
          .catch((err) => console.error("Error adding ice candidate: ", err));
      } else {
        queue.push(event);
        return;
      }
      break;
    case "Sdp":
      if (message.sdp.type === "offer") {
        peerConnection.setRemoteDescription(message.sdp).then(() =>
          peerConnection
            .createAnswer()
            .then(setDescription)
            .catch((err) => console.error("Error creating answer: ", err)),
        );
      } else if (message.sdp.type === "answer") {
        peerConnection
          .setRemoteDescription(message.sdp)
          .catch((err) =>
            console.error("Error setting remote description: ", err),
          );
      }
      break;
    case "Close":
      close();
      return;
    case "Pong":
      console.debug("pong");
      break;
    default:
      console.error("Unknown message type: ", message);
      break;
  }

  if (queue.length > 0 && peerConnection.remoteDescription) {
    messageHandler(queue.shift());
  }
}
