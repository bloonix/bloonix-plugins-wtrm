"use strict";

var WTRM = function(o) {
    var object = Extend({
        globalTimeout: 120000,
        pageWidth: 1600,
        pageHeight: 800,
        globalSettings: {
            loadImages: true,
            resourceTimeout: 30000,
            userAgent: "Bloonix-Web-Transaction-Monitor"
        }
    }, o);

    // Validate the incoming request for allowed actions.
    object.allowedActions = {
        doAuth: true,
        doUserAgent: true,
        doUrl: true,
        doFill: true,
        doClick: true,
        doSubmit: true,
        doCheck: true,
        doUncheck: true,
        doSelect: true,
        doSleep: true,
        doWaitForElement: true,
        checkUrl: true,
        checkIfElementExists: true,
        checkIfElementNotExists: true,
        checkIfElementHasText: true,
        checkIfElementHasNotText: true,
        checkIfElementHasHTML: true,
        checkIfElementHasNotHTML: true,
        checkIfElementHasValue: true,
        checkIfElementHasNotValue: true,
        checkIfElementIsChecked: true,
        checkIfElementIsNotChecked: true,
        checkIfElementIsSelected: true,
        checkIfElementIsNotSelected: true
    };

    // Safe the step results.
    object.resourceStatus = {};

    object.create = function() {
        Debug("create()");
        this.loadModules();
        this.getSystemArgs();
        this.runTransaction();
    };

    object.loadModules = function() {
        Debug("loadModules()");
        this.webserver = require("webserver");
        this.pageObject = require("webpage");
        this.system = require("system");
        this.fs = require("fs");
    };

    object.createPage = function() {
        Debug("createPage()");
        var self = this;

        if (this.page) {
            this.page.stop();
            this.page.close();
        }

        this.page = this.pageObject.create();
        this.page.viewportSize = {
            width: this.pageWidth,
            height: this.pageHeight
        };
        this.page.settings.loadImages = this.globalSettings.loadImages;
        this.page.settings.resourceTimeout = this.globalSettings.resourceTimeout;
        this.page.settings.userAgent = this.globalSettings.userAgent;
        this.page.onResourceReceived = function(res) {
            if (res.stage == "start") {
                self.resourceStatus[res.url] = {
                    status: res.status,
                    contentType: res.contentType,
                    bodySize: res.bodySize,
                    headers: res.headers
                };
            }
        };
        this.page.onError = function (msg, trace) {
            self._result.message = msg;
            //trace.forEach(function(item) {
            //    self._result.debug.push("-- "+ item.file +":"+ item.line);
            //})
        };
        this.page.onResourceError = function(resourceError) {
            self.page.reason = resourceError.errorString;
            self.page.reasonUrl = resourceError.url;
        };
    };

    object.getSystemArgs = function() {
        Debug("getSystemArgs()");
        this.args = {};
        var self = this;

        for (var i = 0; i < this.system.args.length; i++) {
            var arg = this.system.args[i],
                p = arg.split("="),
                key = p[0];

            if (p[1] == undefined) {
                self.args[key] = true;
            } else {
                self.args[key] = p[1];
            }
        }

        if (this.args.timeout) {
            this.globalTimeout = this.args.timeout;
        }
    };

    object.runTransaction = function() {
        if (this.args.port) {
            this.startWebserver();
        } else {
            this.runSteps();
        }
    };

    object.startWebserver = function() {
        Debug("startWebserver()");
        var self = this;
        this.server = this.webserver.create();
        this.service = this.server.listen(this.args.port, function(request, response) {
            self.processRequest(request, response);
        });
    };

    object.processRequest = function(request, response) {
        Debug("processRequest()");
        this.request = JSON.parse(request.post);

        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json");
        response.write(JSON.stringify({ status: "ok", data: [] }));
        response.close();

        if (this.request.quit == true) {
            phantom.exit();
        }
    };

    object.runSteps = function() {
        Debug("runSteps()");
        this.setGlobalTimeout();
        this.readConfig();
        this.runStep(0);
    };

    object.runStep = function(x) {
        Debug("runStep()");

        var self = this,
            step = this.config[x];

        if (step == undefined) {
            this.done();
        }

        var result = this._result = { step: step, num: x, id: step.id, debug: [] },
            next = x + 1;

        if (step.action == undefined) {
            this.die("no action defined");
        }

        if (this.allowedActions[step.action] == undefined) {
            this.die("invalid action "+ step.action);
        }

        if (step.action == "doUrl") {
            this.resourceStatus = {};
            this.openPage(step, next, result);
        } else if (step.action == "doSleep") {
            result.start = new Date().getTime();
            setTimeout(function() {
                result.stop = new Date().getTime();
                result.took = result.stop - result.start;
                result.success = true;
                result.message = "sleeped for "+ step.ms +"ms";
                self.createScreenshot(result);
                self.ok(result);
                self.runStep(next);
            }, parseInt(step.ms));
        } else if (step.action == "doWaitForElement") {
            this.waitForElement(step, next, result);
        } else {
            result.start = new Date().getTime();
            var url = this.resourceStatus[step.url];
            var ret;

            if (step.action == "checkUrl") {
                ret = this.checkUrl(step);
            } else if (step.action == "doAuth") {
                this.page.settings.userName = step.username;
                this.page.settings.password = step.password;
                ret = { success: true };
            } else if (step.action == "doUserAgent") {
                this.globalSettings.userAgent = step.userAgent;
                ret = { success: true };
            } else {
                ret = this.page.evaluate(this.evaluate, step);
                if (ret && ret.debug) {
                    Dump(ret.debug);
                }
            }

            result.stop = new Date().getTime();
            result.took = result.stop - result.start;
            this.createScreenshot(result);

            if (ret == undefined) {
                result.success = false;
            } else {
                result.success = ret.success;
                result.message = ret.message;
                if (ret.debug && ret.debug.length > 0) {
                    for (var i = 0; i < ret.debug.length; i++) {
                        result.debug.push(ret.debug[i]);
                    }
                }
            }

            this.ok(result);

            if (result.success || step.acceptError == true) {
                setTimeout(function() { self.runStep(next) }, 50);
            } else {
                self.done();
            }
        }
    };

    object.setGlobalTimeout = function(timeout) {
        var self = this;

        if (timeout == undefined) {
            timeout = this.globalTimeout;
        }

        if (this.globalTimeoutObject) {
            clearTimeout(this.globalTimeoutObject);
        }

        this.globalTimeoutObject = setTimeout(function() {
            self.handleGlobalTimeout();
        }, timeout);
    };

    object.handleGlobalTimeout = function() {
        var result = this._result;
        result.success = false;
        result.message = "Global timeout exceeded!";
        if (result.start === undefined) {
            result.start = 0;
        }
        result.stop = new Date().getTime();
        result.took = result.stop - result.start;
        this.ok(result);
        phantom.exit();
    };

    object.readConfig = function() {
        Debug("readConfig()");
        var fh = this.fs.open(this.args.file, "r");
        var content = fh.read();

        if (!content) {
            this.die("No commands to execute");
        }

        this.config = JSON.parse(content);
    };

    object.openPage = function(step, next, result) {
        Debug("doUrl()");

        var self = this;
        result.start = new Date().getTime();

        this.createPage();

        this.page.open(step.url, function(status) {
            result.stop = new Date().getTime();
            result.took = result.stop - result.start;
            result.status = self.lastRequestStatus;
            result.url = self.lastRequestURL;
            self.createScreenshot(result);

            if (status !== "success") {
                result.success = false;
                result.message = "Unable to load the URL!";
                if (self.page.reason) {
                    result.message += " ["+ self.page.reason +": "+ self.page.reasonUrl +"]";
                }
                self.report(result);
                self.done();
            } else {
                result.success = true;
                self.report(result);
                setTimeout(function() { self.runStep(next) }, 100);
            }
        });
    };

    object.waitForElement = function(step, next, result, startTime, endTime) {
        Debug("waitForElement()");
        if (startTime == undefined) {
            startTime = result.start = new Date().getTime();
            endTime = startTime + 30000;
        }

        this.checkIfElementExists(step, next, result, startTime, endTime);
    };

    object.checkIfElementExists = function(step, next, result, startTime, endTime) {
        Debug("checkIfElementExists()");
        var self = this,
            ret = this.page.evaluate(this.evaluate, step),
            curTime = new Date().getTime();

        if (curTime >= endTime || (ret && ret.success == true)) {
            result.stop = new Date().getTime();
            result.took = result.stop - result.start;
            this.createScreenshot(result);

            if (ret.success == true) {
                result.success = true;
            } else if (curTime >= endTime) {
                result.message = "Wait for elements timed out after 30 seconds!";
                result.success = false;
            }

            this.report(result);

            if (result.success) {
                setTimeout(function() { self.runStep(next) }, 100);
            } else {
                self.done();
            }
        } else {
            setTimeout(function() {
                self.waitForElement(step, next, result, startTime, endTime);
            }, 200);
        }
    };

    object.createScreenshot = function(result) {
        if (this.args.noimg == undefined) {
            result.image = this.page.renderBase64('PNG');
        }
    };

    // START evaluate
    object.evaluate = function(o) {
        var ret = false,
            message = "", elements = [], debug = [],
            eId, eClass, eName, eTag, eTagNum, eTagAttrs = [];

        var searchForSubElements = function(element, attr, value) {
            if (element) {
                var e = element.getElementsByTagName("*"), r = [];

                for (var i = 0; i < e.length; i++) {
                    if (e[i].hasAttribute(attr)) {
                        if (e[i].getAttribute(attr) === value) {
                            r.push(e[i]);
                        }
                    }
                }

                return r;
            }
        };

        var searchForObjects = function() {
            /*  tagRegex

                Valid strings:

                    <h1 id="abc" class="foo bar baz">
                    <h1 id="abc" a-b-c="foo bar baz">
                    <h1[1]>
                    <h1[5] id="abc" abc='foo bar baz'>
                    <h1[99] id="abc" abc="foo bar baz">
                    <h1>

                Invalid strings:

                    <h1 id='abc" class="foo bar baz">
                    <h1[100]>
                    <h1 id="abc" x s s="">
                    <h1 id="abc'>
            */
            var tagRegex = /^<\s*([a-zA-Z0-9]{1,16})(?:\[(\d{1,2})\]){0,1}((:?\s+[a-zA-Z0-9_\-]+=(?:'[^']*'|"[^"]*"))*)\s*>$/;

            if (o.element) {
                if (/^#/.test(o.element)) {
                    eId = o.element.replace(/^#/, "");
                } else if (/^\./.test(o.element)) {
                    eClass = o.element.replace(/^\./, "");
                } else if (tagRegex.test(o.element)) {
                    var m = tagRegex.exec(o.element);
                    m.shift();
                    eTag = m.shift();
                    eTagNum = m.shift();
                    var attrs = m.shift();

                    if (eTagNum !== undefined) {
                        eTagNum = parseInt(eTagNum) - 1;
                    }

                    if (attrs !== undefined && /\s+[a-zA-Z0-9_\-]+=(?:'[^']*'|"[^"]*")/.test(attrs)) {
                        var a = attrs.match(/\s+([a-zA-Z0-9_\-]+=(?:'[^']*'|"[^"]*"))/g);

                        for (var i = 0; i < a.length; i++) {
                            a[i] = a[i].replace(/^\s+/, "");
                            a[i] = a[i].replace(/\s+$/, "");
                            var kv = a[i].split("=");
                            kv[1] = kv[1].replace(/^["']/, "");
                            kv[1] = kv[1].replace(/["']$/, "");
                            eTagAttrs.push({ attr: kv[0], value: kv[1] });
                        }
                    }
                } else {
                    eName = o.element;
                }

                var e, p;

                if (o["parent"]) {
                    var pId = o["parent"].replace(/^#/, "");
                    debug.push("document.getElementById("+ pId +")");
                    p = document.getElementById(pId);
                } else {
                    p = document;
                }

                if (p !== undefined) {
                    if (eId && o["parent"] === undefined) {
                        debug.push("document.getElementById("+ eId +")");
                        if (o["parent"]) {
                            e = searchForSubElements(p, "id", eName);
                        } else {
                            e = [ p.getElementById(eId) ];
                        }
                    } else if (eClass) {
                        debug.push("document.getElementsByClassName("+ eClass +")");
                        e = p.getElementsByClassName(eClass);
                    } else if (eName) {
                        debug.push("document.getElementsByName("+ eName +")");
                        if (o["parent"]) {
                            e = searchForSubElements(p, "name", eName);
                        } else {
                            e = p.getElementsByName(eName);
                        }
                    } else if (eTag) {
                        var tags = p.getElementsByTagName(eTag);

                        // No attributes and no tag num set:
                        //   <a>, get first
                        if (eTagNum === undefined && eTagAttrs.length == 0) {
                            e = [ tags[0] ];
                        }

                        // No atributes set:
                        //   <a[5]>, get fifth
                        else if (eTagNum !== undefined && eTagAttrs.length == 0) {
                            e = [ tags[eTagNum] ];

                        }

                        // Attributes are set and maybe a tag num:
                        //   <a[5] foo="bar">, parse attributes of the fifth a tag
                        //   <a foo="bar">, parse attributes of all a tags
                        else {
                            var t;

                            // Tag num is set:
                            //   <a[5] foo="bar">
                            if (eTagNum !== undefined) {
                                t = [ tags[eTagNum] ];
                            }

                            // No tag num is set:
                            //   <a foo="bar">
                            else {
                                t = tags;
                            }

                            // Now parse the attribues for all found tags
                            for (var x = 0; x < t.length; x++) {
                                var tag = t[x],
                                    foundAttrs = 0;

                                for (var y = 0; y < eTagAttrs.length; y++) {
                                    var attr = eTagAttrs[y];

                                    if (tag.getAttribute(attr.attr) === attr.value) {
                                        foundAttrs++;
                                    }
                                }

                                if (foundAttrs === eTagAttrs.length) {
                                    if (e === undefined) {
                                        e = [];
                                    }
                                    e.push(tag);
                                }
                            }
                        }
                    }
                }

                if (e) {
                    for (var i = 0; i < e.length; i++) {
                        if (e[i]) {
                            elements.push(e[i]);
                        }
                    }
                }

                if (elements.length == 0) {
                    debug.push("element not found");
                }
            }
        }();

        // Action: doFill
        if (o.action == "doFill") {
            for (var i = 0; i < elements.length; i++) {
                var obj = elements[i],
                    tag = obj.tagName.toLowerCase();

                if (tag == "input" || tag == "textarea") {
                    obj.value = o.value;
                    ret = true;
                } else {
                    message = "HTML tag '"+ tag +"' is not a valid element to fill in form data!";
                    ret = false;
                    break;
                }
            }
        }

        // Action: doClick
        else if (o.action == "doClick") {
            for (var i = 0; i < elements.length; i++) {
                var obj = elements[i],
                    event = document.createEvent("MouseEvents");
                event.initMouseEvent("click", true, true, window, 1, 0, 0);
                obj.dispatchEvent(event);
                ret = true;
            }
        }

        // Action: doSubmit
        else if (o.action == "doSubmit") {
            for (var i = 0; i < elements.length; i++) {
                var obj = elements[i].submit();
                ret = true;
            }
        }

        // Action: doCheck
        else if (o.action == "doCheck" || o.action == "doUncheck") {
            for (var i = 0; i < elements.length; i++) {
                var obj = elements[i];

                if (eId || eClass || (eName && obj.value == o.value)) {
                    obj.checked = o.action == "doCheck" ? true : false;
                    ret = true;
                }
            }
        }

        // Action: doSelect
        else if (o.action == "doSelect") {
            for (var i = 0; i < elements.length; i++) {
                var obj = elements[i],
                    tag = obj.tagName.toLowerCase();

                if (tag == "select") {
                    for (var i = 0; i < obj.options.length; i++) {
                        if (obj.options[i].value == o.value) {
                            obj.selectedIndex = i;
                            ret = true;
                        }
                    }
                } else { // ul, ol, dl, dir, menu, ...
                    var ul = obj.getElementsByTagName("li");
                    if (ul) {
                        for (var i = 0; i < ul.length; i++) {
                            var obj = ul[i];

                            if (obj.innerHTML == o.value) {
                                ret = true;
                            }
                        }
                    }
                }
            }
        }

        // Action: checkIfElementExists + doWaitForElement
        else if (o.action == "checkIfElementExists" || o.action == "doWaitForElement") {
            if (elements.length > 0) {
                ret = true;
            }
        }

        // Action: checkIfElementNotExists
        else if (o.action == "checkIfElementNotExists") {
            if (elements.length == 0) {
                ret = true;
            }
        }

        // Action: checkIfElementHasText + checkIfElementHasNotText
        else if (o.action == "checkIfElementHasText" || o.action == "checkIfElementHasNotText") {
            if (o.action == "checkIfElementHasNotText") {
                ret = true;
            }

            for (var i = 0; i < elements.length; i++) {
                var obj = elements[i];

                if (obj.innerText == o.text) {
                    ret = o.action == "checkIfElementHasText" ? true : false;
                    break;
                }
            }
        }

        // Action: checkIfElementHasElement + checkIfElementHasNotElement
        else if (o.action == "checkIfElementHasHTML" || o.action == "checkIfElementHasNotHTML") {
            if (o.action == "checkIfElementHasNotHTML") {
                ret = true;
            }

            for (var i = 0; i < elements.length; i++) {
                var obj = elements[i];

                if (obj.innerHTML == o.html) {
                    ret = o.action == "checkIfElementHasHTML" ? true : false;
                    break;
                }
            }
        }

        // Action: checkIfElementHasValue + checkIfElementHasNotValue
        else if (o.action == "checkIfElementHasValue" || o.action == "checkIfElementHasNotValue") {
            if (o.action == "checkIfElementHasNotValue") {
                ret = true;
            }

            for (var i = 0; i < elements.length; i++) {
                var obj = elements[i],
                    tag = obj.tagName.toLowerCase();

                if (tag == "input" || tag == "textarea") {
                    if (obj.value == o.value) {
                        ret = o.action == "checkIfElementHasValue" ? true : false;
                        break;
                    }
                } else {
                    message = "HTML tag '"+ tag +"' is not a valid element to select form data!";
                    break;
                }
            }
        }

        // Action: checkIfElementIsChecked
        else if (o.action == "checkIfElementIsChecked" || o.action == "checkIfElementIsNotChecked") {
            if (o.action == "checkIfElementIsNotChecked") {
                ret = true;
            }

            for (var i = 0; i < elements.length; i++) {
                var obj = elements[i];

                if (eId || eClass || (eName && obj.value == o.value)) {
                    if (obj.checked) {
                        ret = o.action == "checkIfElementIsChecked" ? true : false;
                    }
                    break;
                }
            }
        }

        // Action: checkIfElementIsSelected
        else if (o.action == "checkIfElementIsSelected" || o.action == "checkIfElementIsNotSelected") {
            if (o.action == "checkIfElementIsNotSelected") {
                ret = true;
            }

            for (var i = 0; i < elements.length; i++) {
                var obj = elements[i],
                    tag = obj.tagName.toLowerCase();

                if (tag == "select") {
                    var selected = obj.selectedIndex;

                    if (obj.options[selected].value == o.value) {
                        ret = o.action == "checkIfElementIsSelected" ? true : false;
                        break;
                    }
                } else { // ul, ol, dl, dir, menu, ...
                    var ul = obj.getElementsByTagName("li"),
                        _break = false;
                    if (ul) {
                        for (var i = 0; i < ul.length; i++) {
                            var obj = ul[i];

                            if (obj.innerText == o.value) {
                                ret = o.action == "checkIfElementIsSelected" ? true : false;
                                _break = true;
                                break;
                            }
                        }
                    }

                    if (_break) {
                        break;
                    }
                }
            }
        }

        return { success: ret, message: message, debug: debug };
    };
    // END evaluate

    object.checkUrl = function(o) {
        var url = this.resourceStatus[o.url],
            success = true,
            message = [],
            toCheck = [ "status", "contentType" ];

        if (url == undefined) {
            return { success: false, message: "url '"+ o.url +"'not found" };
        }

        for (var i = 0; i < toCheck.length; i++) {
            var str = toCheck[i];

            if (o[str] && o[str] !== url[str].toString()) {
                success = false;
                message.push("The "+ str +" '"+ o[str] +"' does not match '"+ url[str] +"'!");
            }
        }

        if (message.length == 0) {
            message = undefined;
        } else if (message.length == 1) {
            message = message[0];
        }

        return { success: success, message: message };
    };

    object.die = function(m) {
        Debug("die()");
        console.log(JSON.stringify({ status: "err", message: m }));
        phantom.exit();
    };

    object.ok = function(m) {
        Debug("ok()");
        console.log(JSON.stringify({ status: "ok", data: m }));
    };

    object.report = function(result) {
        Debug("report()");
        this.ok(result);
    };

    object.done = function() {
        Debug("done()");
        console.log(JSON.stringify({ status: "done" }));
        phantom.exit();
    };

    object.create();
};

var Extend = function(a, b) {
    if (a == undefined) {
        a = {};
    }
    if (b) {
        var n;
        for (n in b) {
            a[n] = b[n];
        }
    }
    return a;
};

var Dump = function(o) {
    //console.log(JSON.stringify(o, null, "\t"));
};

var Debug = function(message) {
    //console.log(message);
};

WTRM();
