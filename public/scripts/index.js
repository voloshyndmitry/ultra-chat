let isAlreadyCalling = false;
let getCalled = false;

const existingCalls = [];
const socket = io.connect("ultra-chat.herokuapp.com");
const talkingWithInfo = document.getElementById("talking-with-info");
const userContainerEl = document.createElement("div");
const usernameEl = document.createElement("p");
const defaultTitle = "Select active user on the left menu";

const { RTCPeerConnection, RTCSessionDescription } = window;

const peerConnection = new RTCPeerConnection();

function setTitle(text = defaultTitle) {
  talkingWithInfo.innerHTML = text;
}

function unselectUsersFromList() {
  const alreadySelectedUser = document.querySelectorAll(
    ".active-user.active-user--selected"
  );

  alreadySelectedUser.forEach((el) => {
    el.setAttribute("class", "active-user");
  });
}

function createUserItemContainer(socketId) {
  userContainerEl.setAttribute("class", "active-user");
  userContainerEl.setAttribute("id", socketId);
  usernameEl.setAttribute("class", "username");
  usernameEl.innerText = `User: ${socketId}`;

  userContainerEl.appendChild(usernameEl);

  function handleClick() {
    // if (isAlreadyCalling) {
    //   alert("You already in call");
    //   return;
    // }
    // isAlreadyCalling = true;
    unselectUsersFromList();
    userContainerEl.setAttribute("class", "active-user active-user--selected");
    setTitle(`Calling ...`);
    callUser(socketId);
  }

  userContainerEl.addEventListener("click", debounce(handleClick, 1000));

  return userContainerEl;
}

async function callUser(socketId) {
  try {
    const offer = await peerConnection.createOffer();

    await peerConnection.setLocalDescription(new RTCSessionDescription(offer));
    console.log("offer >>>>", offer);
    socket.emit("call-user", {
      offer,
      to: socketId,
    });
  } catch (error) {
    setTitle();
    isAlreadyCalling = false;
  }
}

socket.on("call-made", async (data) => {
  console.log("call-made<<<");

  const confirmed = confirm(
    `User "Socket: ${data.socket}" wants to call you. Do accept this call?`
  );
  console.log("confirmed >>>>", confirmed);

  if (!confirmed) {
    socket.emit("reject-call", {
      from: data.socket,
    });

    return;
  }
  //   }

  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(data.offer)
  );

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(new RTCSessionDescription(answer));

  socket.emit("make-answer", {
    answer,
    to: data.socket,
  });

  talkingWithInfo.innerHTML = `Talking with ${data?.socket}`;
  getCalled = true;
});

socket.on("answer-made", async (data) => {
  console.log("answer-made<<<", data);

  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(data.answer)
  );

  if (!isAlreadyCalling) {
    console.log("Call user!");
    callUser(data.socket);
    isAlreadyCalling = true;
  }
});

socket.on("call-rejected", (data) => {
  console.log("call-rejected<<<");
  setTitle();
  alert(`User: "Socket: ${data.socket}" rejected your call.`);
  unselectUsersFromList();
});

/**
 * VIDEO BLOCKS:
 */

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
  audio: true,
  video: {
    facingMode: "user",
    width: { min: 1024, ideal: 1280, max: 1920 },
    height: { min: 576, ideal: 720, max: 1080 },
  },
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

/**
 * USER LIST:
 */

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

socket.on("update-user-list", ({ users }) => {
  console.log("update-user<<<");

  updateUserList(users);
});

socket.on("remove-user", ({ socketId }) => {
  console.log("remove-user<<<");

  const elToRemove = document.getElementById(socketId);

  if (elToRemove) {
    elToRemove.remove();
  }
});

function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}
