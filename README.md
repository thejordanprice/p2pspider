# p2pspider

[![GitHub issues](https://img.shields.io/github/issues/thejordanprice/p2pspider.svg)](https://github.com/thejordanprice/p2pspider/issues)
[![GitHub stars](https://img.shields.io/github/stars/thejordanprice/p2pspider.svg)](https://github.com/thejordanprice/p2pspider/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/thejordanprice/p2pspider.svg)](https://github.com/thejordanprice/p2pspider/network)
[![GitHub license](https://img.shields.io/github/license/thejordanprice/p2pspider.svg)](https://github.com/thejordanprice/p2pspider/blob/master/LICENSE)
[![Twitter](https://img.shields.io/twitter/url/https/github.com/thejordanprice/p2pspider.svg?style=social)](https://twitter.com/intent/tweet?text=Wow:&url=https%3A%2F%2Fgithub.com%2Fthejordanprice%2Fp2pspider)

Daemon that scrapes the DHT swarm and an express bootstrapped front-end connected to the same mongodb to create an automated magnet db with search.

### Intro

This can index over 1 million magnets per 24/hr on 2GB of RAM and around 2MB/s connection. It is a RAM/CPU hog though, it will consume 100% of the CPU and the RAM if allowed and can be controlled via the 'ecosystem.json' file. On 2GB RAM it is suggested to use 8 instances of the daemon and 2 of the webserver; all limited at 175MB.

###### Screenshots

![Screenshot][index]

[index]: https://i.imgur.com/tXdoy2I.png "index page"

### Getting Started

    apt install mongodb
    apt install redis-server
    npm install -g pm2
    npm install
    pm2 start ecosystem.json
    pm2 monit
    
### Configuration

**You will need to have a port open on the outside and defined, by default it is 6881.**

Some minor configuration and tweaks can be done, depending on the hardware and connection you are connected to; you may want to experiment with some of these settings. In the bin/daemon.js file you can find a block of code that looks like this below.

    const p2p = P2PSpider({
        nodesMaxSize: 250,
        maxConnections: 500,
        timeout: 1000
    });

It isn't reccomended changing the nodesMaxSize or the maxConnections, but timeout seems to be a possibility to get your indexing to go faster. It may require a little bit more RAM with a higher timeout though, the highest we would reccomend at the time is 5000ms.

**Would like to keep the information private easily?**

I have added a section of code to bin/webserver.js that will add basic authentication with mutliple users possible by default. It looks like this below. If you would like to remove this feature, you can either change challenge to false, or just comment out the entire block.

    app.use(basicAuth({
    users: {
        'username': 'password',
        'username': 'password',
    },
    challenge: true,
    realm: 'Secret Place'
    }));

### Protocols

[bep_0005](http://www.bittorrent.org/beps/bep_0005.html), [bep_0003](http://www.bittorrent.org/beps/bep_0003.html), [bep_0010](http://www.bittorrent.org/beps/bep_0010.html), [bep_0009](http://www.bittorrent.org/beps/bep_0009.html)

### Notes

Cluster mode will not and will never work on Windows... With other OSs we can get multiple instances listening on the same UDP port. For the more technical folks, Windows doesn't allow us to get down to the lower levels of our system like Linux and various others do. We simply cannot touch things at the hardware level while using that operating system.

### Notice

Please don't share the data p2pspider crawled to the internet. Because sometimes it crawls sensitive/copyrighted/porn data.

## License

MIT
