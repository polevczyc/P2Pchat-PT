document.addEventListener("DOMContentLoaded", function() {
    const peer = new Peer();
    let conn;
    let connections = [];
    let receivedBuffers = [];
    let receivedSize = 0;
    

    peer.on('open', id => {
        document.getElementById('my-id').value = `${id}`;
    });

    document.getElementById('connect').addEventListener('click', function() {
        if (connections.length >= 1) {
            displayMessage("Cannot connect: You can't connect to more than one user.");
            return;
        }
        const connectToId = document.getElementById('connect-to').value;
        conn = peer.connect(connectToId);
        setupConnectionHandlers(conn);
    });

    peer.on('connection', connection => {
        if (connections.length >= 1) {
            console.log('Incoming connection from', connection.peer, 'rejected: Limit of two connections reached');
            connection.close();
            return;
        }
        conn = connection;
        setupConnectionHandlers(conn);
    });

    function setupConnectionHandlers(conn) {
        if (connections.length >= 1) {
            console.log('Cannot setup connection: Limit of two connections reached');
            displayMessage("Cannot setup connection: Limit of two connections reached");
            conn.close();
            return;
        }
        connections.push(conn);
        updateActiveConnections();

        conn.on('open', () => {
            console.log("Connection established with", conn.peer);
        });

        conn.on('data', function(data) {
            if (data.type === 'file') {
                if (!data.endOfFile) {
                    receivedBuffers.push(data.data);
                    receivedSize += data.data.byteLength;
                } else {
                    const totalArrayBuffer = new Uint8Array(receivedSize),
                          view = new Uint8Array(data.data);
                    let pos = 0;
                    for (let buffer of receivedBuffers) {
                        totalArrayBuffer.set(new Uint8Array(buffer), pos);
                        pos += buffer.byteLength;
                    }
                    totalArrayBuffer.set(view, pos);
                    displayFile(new Blob([totalArrayBuffer], {type: data.filetype}), data.filename);
                    receivedBuffers = [];
                    receivedSize = 0;
                }
            } else {
                displayMessage(`Friend: ${data}`);
            }
        });

        conn.on('close', () => {
            connections = connections.filter(c => c !== conn);
            updateActiveConnections();
            console.log('Connection closed with', conn.peer);
        });

        conn.on('error', err => {
            connections = connections.filter(c => c !== conn);
            updateActiveConnections();
            console.error('Connection error with', conn.peer, ':', err);
        });
    }

    document.getElementById('send').addEventListener('click', () => sendMessage(conn));

    document.getElementById('sendFile').addEventListener('click', function() {
        document.getElementById('fileInput').click();
    });
    
    document.getElementById('fileInput').addEventListener('change', function() {
        const selectedFile = this.files[0];
        if (selectedFile) {
            sendFile(selectedFile); // Call the function to send the file
        }
    });
    
    function clearInput(id) {
        document.getElementById(id).value = '';
    }
    
    function sendMessage(conn) {
        const message = document.getElementById('message').value;
        if (conn && conn.open) {
            conn.send(message);
            displayMessage(`Me: ${message}`);
            clearInput('message');
        } else {
            console.log('Connection is closed.');
        }
    }      

    function sendFile(file) {
        const chunkSize = 16 * 1024;
        let offset = 0;

        const reader = new FileReader();
        reader.onload = function(e) {
            conn.send({
                type: 'file',
                filename: file.name,
                filetype: file.type,
                data: e.target.result
            });
            offset += e.target.result.byteLength;
            if (offset < file.size) {
                readSlice(offset);
            } else {
                conn.send({type: 'file', filename: file.name, filetype: file.type, endOfFile: true});
                displayMessage(`Me: Sent a file (${file.name})`);
            }
        };
        reader.onerror = function(err) {
            console.error('File reading error:', err);
        };

        const readSlice = o => {
            const slice = file.slice(o, o + chunkSize);
            reader.readAsArrayBuffer(slice);
        };

        readSlice(0);
    }

    function displayFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.textContent = `Friend: Download ${filename}`;
        document.getElementById('messages').appendChild(anchor);
    }

    function displayMessage(message) {
        const messagesDiv = document.getElementById('messages');
        const messageParagraph = document.createElement('p');
        messageParagraph.textContent = message;
        messagesDiv.appendChild(messageParagraph);
    }

    function updateActiveConnections() {
        const activeConnectionsDiv = document.getElementById('active-connections');
        activeConnectionsDiv.innerHTML = ''; // Clear existing connections
    
        connections.forEach((conn, index) => {
            activeConnectionsDiv.innerHTML += `<span style="color: black;">Connection is </span><strong style="color: green;">active</strong><br>`;
        });
    }

    document.getElementById('copy').addEventListener('click', copyButton);

    function copyButton() {
        var copyText = document.getElementById("my-id");
        copyText.select();
        copyText.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(copyText.value);
    }

    var enterButton = document.getElementById('enterButton');
    var welcomeOverlay = document.getElementById('welcomePage');
    var chatPage = document.querySelector('.chatPage');
    var videoPage = document.getElementById('videoChatPage');

    var myVideo = document.getElementById('my-video');
    var remoteVideo = document.getElementById('remote-video');
    var connectButton = document.getElementById('connect-button');
    var closeButton = document.getElementById('closeCall');

    enterButton.addEventListener('click', function () {
        welcomeOverlay.classList.add('hidden');
        chatPage.classList.remove('hidden');
    });

    document.getElementById('enterVideoChat').addEventListener('click', function () {
        videoPage.classList.remove('hidden');
        startVideoStream();
    });

    function startVideoStream() {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            localStream = stream;
            document.getElementById('my-video').srcObject = stream;
        })
        .catch(error => {
            console.error('Failed to access camera: ', error);
        });
    }

    connectButton.addEventListener('click', () => {
        const call = peer.call(document.getElementById('connect-to').value, localStream);
        call.on('stream', remoteStream => {
            remoteVideo.srcObject = remoteStream;
        });
    });

    peer.on('call', call => {
        call.answer(localStream);
        call.on('stream', remoteStream => {
            remoteVideo.srcObject = remoteStream;
        });
    });

    closeButton.addEventListener('click', function() {
        videoPage.classList.add('hidden');
        if (localStream) {
            localStream.getTracks().forEach(track => {
                if (track.kind === 'video' || track.kind === 'audio') {
                    track.stop();
                }
            });
        }
        document.getElementById('remote-video').srcObject = null;
        document.getElementById('my-video').srcObject = null;
    });
});
