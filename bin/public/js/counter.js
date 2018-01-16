$(() => {
    let socket = io();
    socket.on('count', (msg) => {
        $('#counter').html(msg + " magnets...");     
    });
});