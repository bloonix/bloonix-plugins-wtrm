"use strict;"

var log = function(o) {
    console.log(JSON.stringify(o));
};

var dump = function(o) {
    console.log(JSON.stringify(o, undefined, 4));
};

var webserver = require("webserver"),
    pageObject = require("webpage"),
    system = require("system");

var args = {
    url: false,
    globalTimeout: 60000,
    resourceTimeout: 30000,
    loadImage: true,
    pageWidth: 1600,
    pageHeight: 800,
    userAgent: "Bloonix-Web-Pagespeed-Monitor"
};

// script.js foo=bar baz
//     { "foo": "bar", "baz": true }
for (var i = 0; i < system.args.length; i++) {
    var arg = system.args[i],
        p = arg.split("="),
        key = p[0];

    if (p[1] === undefined) {
        args[key] = true;
    } else {
        args[key] = p[1];
    }
}

var page = this.pageObject.create();

page.settings.loadImages = args.loadImages;
page.settings.resourceTimeout = parseFloat(args.resourceTimeout);
page.settings.userAgent = args.userAgent;

page.viewportSize = {
    width: parseFloat(args.pageWidth),
    height: parseFloat(args.pageHeight)
};

page.onResourceRequested = function(request) {
    log({ status: "ok", data: request, type: "request" });
};

page.onResourceReceived = function(response) {
    log({ status: "ok", data: response, type: "response" });
};

if (args.url) {
    setTimeout(function() {
        log({ status: "err", message: "global timeout of 60s exceeded" });
        phantom.exit();
    }, parseFloat(args.globalTimeout));
    page.open(args.url, function(status) {
        if (status === "success") {
            log({ status: "done" });
        } else {
            log({ status: "err", message: "fail to load address" });
        }
        phantom.exit();
    });
} else {
    log({ status: "err", message: "missing mandatory option 'url'" });
    phantom.exit();
}
