import "./style.css";
import { setup } from "./p2p.ts";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <h1>WebRTC</h1>
    <video id="localVideo" playsinline autoplay muted width="480"></video>
    <video id="remoteVideo" playsinline autoplay width="480"></video>
    <div class="card">
      <button id="start" type="button">Start</button>
      <button id="call" type="button">Call</button>
      <button id="stop" type="button">Stop</button>
    </div>
    <p class="read-the-docs">
      Click on the Vite and TypeScript logos to learn more
    </p>
  </div>
`;

setup();
