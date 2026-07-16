import { WebSocket } from "ws";
import { RTCPeerConnection } from "werift";

const ws = new WebSocket("ws://localhost:3000/webrtc-signaling");

ws.on('open', async () => {
  console.log("Connected to signaling");
  const pc = new RTCPeerConnection();
  const dc = pc.createDataChannel("game");
  
  dc.onopen = () => console.log("DATA CHANNEL OPEN!");
  
  pc.onicecandidate = ({candidate}) => {
    if (candidate) {
      console.log("Sending candidate", candidate.toJSON());
      ws.send(JSON.stringify({ type: 'candidate', candidate: candidate.toJSON() }));
    }
  };
  
  ws.on('message', async (data) => {
    const msg = JSON.parse(data.toString());
    console.log("Received signaling:", msg.type);
    if (msg.type === 'answer') {
      await pc.setRemoteDescription(msg);
    } else if (msg.type === 'candidate') {
      await pc.addIceCandidate(msg.candidate);
    }
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws.send(JSON.stringify(offer));
});
setTimeout(() => { console.log("done"); process.exit(0); }, 3000);
