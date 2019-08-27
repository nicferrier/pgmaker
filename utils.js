const net = require("net");


exports.getFreePort = function (){
    let server = net.createServer(function(sock) { sock.close(); });
    return new Promise(function (resolve, reject) {
        try {
            let listener = server.listen(0, "127.0.0.1", function () {
                let address = listener.address();
                server.close();
                resolve(address);
            });
        }
        catch (e) {
            reject(e);
        }
    });
}

// End
