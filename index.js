var Launcher = module.exports = {};
var Bencode = require("bencode");
var Spawn = require("child_process").spawn;
var Path = require("path");
var Crypto = require("crypto");
var Net = require("net");

Launcher.spawnCjdroute = function (path, pipeName, cb) {
    var cjdroute = Spawn(Path.join(path, 'cjdroute'), ['core', pipeName], {
        stdio: 'inherit',
    });

    return cjdroute.on('close', function (code, signal) {
        cb(null, {
            code: code,
            signal: signal,
        });
    }).on('error', function (err) {
        cb(err);
    });
};

Launcher.sendPreconfig = function (conn, priv, bind, pass) {
    var pre = {
        privateKey: priv,
        admin: {
            bind: bind,
            pass: pass,
        }
    };

    var msg = Bencode.encode(pre);
    conn.write(msg);
};

Launcher.run = function (path, config, cb) {
    //console.log("Here we go!");

    if (!path) { return void cb("NO PATH"); }
    if (typeof(config) !== 'object') { return void cb("NO CONFIG");  }

    var cjdroute;
    var pipePrefix = '/tmp/cjdns_pipe_'; // FIXME
    var pipeName = 'client-core-' + Crypto.randomBytes(4).toString('hex');

    var corePipe = Net.createServer();


    var privateKey = config.privatekey;
    var bind = config.admin.bind;
    var password = config.admin.password;

    corePipe.listen(pipePrefix + pipeName);
    corePipe.on('listening', function () {
        cjdroute = Launcher.spawnCjdroute(path, pipeName, function (err) {
            if (err) {
                console.error(err);
                process.exit(1);
            }
            console.log("LAUNCHED!");
        });
    }).on('connection', function (conn) {
        Launcher.sendPreconfig(conn, privateKey, bind, password);
        conn.on('data', function (data) {
            var result = Bencode.decode(data.toString());
            if (result.error !== 'none') {
                if (cjdroute) {
                    cjdroute.kill();// TODO WAT
                }
                console.error(result);
                process.exit(1);
            }
        });
    }).on('error', function (err) {
        console.error(err);
        if (cjdroute) { cjdroute.kill(); }
        process.exit(1);
    });

    console.log(JSON.stringify(config, null, 2));
    //cb();
};

