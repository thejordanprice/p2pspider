$(() => {
    let socket = io();
    socket.on('count', function(msg){
        $('#counter').html(msg + " magnets...");     
    });
});