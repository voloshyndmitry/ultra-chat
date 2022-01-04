let isAlreadyCalling = false;
let getCalled = false;

const existingCalls = [];

const { RTCPeerConnection, RTCSessionDescription } = window;

const peerConnection = new RTCPeerConnection();

function unselectUsersFromList() {
  const alreadySelectedUser = document.querySelectorAll(
    ".active-user.active-user--selected"
  );

  alreadySelectedUser.forEach((el) => {
    el.setAttribute("class", "active-user");
  });
}

function createUserItemContainer(socketId) {
  const userContainerEl = document.createElement("div");

  const usernameEl = document.createElement("p");

  userContainerEl.setAttribute("class", "active-user");
  userContainerEl.setAttribute("id", socketId);
  usernameEl.setAttribute("class", "username");
  usernameEl.innerHTML = `Socket: ${socketId}`;

  userContainerEl.appendChild(usernameEl);

  userContainerEl.addEventListener("click", () => {
    unselectUsersFromList();
    userContainerEl.setAttribute("class", "active-user active-user--selected");
    const talkingWithInfo = document.getElementById("talking-with-info");
    talkingWithInfo.innerHTML = `Talking with: "Socket: ${socketId}"`;
    callUser(socketId);
  });

  return userContainerEl;
}

async function callUser(socketId) {
  console.log("CALL USER <<<< ", socketId);
  console.log("setLocalDescription <<<< ");
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(new RTCSessionDescription(offer));

  socket.emit("call-user", {
    offer,
    to: socketId,
  });
}

function updateUserList(socketIds) {
  const activeUserContainer = document.getElementById("active-user-container");

  socketIds.forEach((socketId) => {
    const alreadyExistingUser = document.getElementById(socketId);
    if (!alreadyExistingUser) {
      const userContainerEl = createUserItemContainer(socketId);

      activeUserContainer.appendChild(userContainerEl);
    }
  });
}

const socket = io.connect("ultra-chat.herokuapp.com");

socket.on("update-user-list", ({ users }) => {
  updateUserList(users);
});

socket.on("remove-user", ({ socketId }) => {
  const elToRemove = document.getElementById(socketId);

  if (elToRemove) {
    elToRemove.remove();
  }
});

socket.on("call-made", async (data) => {
  //   if (getCalled) {
  //     const confirmed = confirm(
  //       `User "Socket: ${data.socket}" wants to call you. Do accept this call?`
  //     );
  //     console.log("confirmed >>>>", confirmed);

  //     if (!confirmed) {
  //       socket.emit("reject-call", {
  //         from: data.socket,
  //       });

  //       return;
  //     }
  //   }
  try {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(data.offer)
    );
  } catch (error) {
    console.log("setRemoteDescription error: ", error);
  }

  console.log(">>> make-answer");
  try {
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(new RTCSessionDescription(answer));
  } catch (error) {
    console.log("setLocalDescription error: ", error);
  }

  console.log("answer >>>", answer);

  socket.emit("make-answer", {
    answer,
    to: data.socket,
  });
  getCalled = true;
});

socket.on("answer-made", async (data) => {
  try {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(data.answer)
    );
  } catch (error) {
    console.log("ERROR <<<<", error);
  }
  if (!isAlreadyCalling) {
    callUser(data.socket);
    isAlreadyCalling = true;
  }
});

socket.on("call-rejected", (data) => {
  alert(`User: "Socket: ${data.socket}" rejected your call.`);
  unselectUsersFromList();
});

peerConnection.ontrack = function ({ streams: [stream] }) {
  const remoteVideo = document.getElementById("remote-video");
  remoteVideo.setAttribute("playsinline", true);

  if (remoteVideo) {
    if ("srcObject" in remoteVideo) {
      remoteVideo.srcObject = stream;
    } else {
      // Avoid using this in new browsers, as it is going away.
      remoteVideo.src = window.URL.createObjectURL(stream);
    }
    remoteVideo.onloadedmetadata = function (e) {
      remoteVideo.play();
    };
  }
};
const options = {
  video: {
    facingMode: "user",
    width: { min: 1024, ideal: 1280, max: 1920 },
    height: { min: 576, ideal: 720, max: 1080 },
  },
  audio: true,
};

navigator.mediaDevices
  .getUserMedia(options)
  .then((stream) => {
    const video = document.getElementById("local-video");
    video.setAttribute("playsinline", true);
    if (video) {
      if ("srcObject" in video) {
        video.srcObject = stream;
      } else {
        // Avoid using this in new browsers, as it is going away.
        video.src = window.URL.createObjectURL(stream);
      }
      video.onloadedmetadata = function (e) {
        video.play();
      };
    }

    stream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, stream));
  })
  .catch((error) => {
    console.warn(error.message);
  });
