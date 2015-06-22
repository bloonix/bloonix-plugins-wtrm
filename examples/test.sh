#!/bin/bash

WTRM="/usr/local/lib/bloonix/js/bloonix-wtrm.js"
TESTJS="test.json"

cat <<EOF >$TESTJS
[
   {
      "action" : "doUrl",
      "url" : "https://www.bloonix.de/",
      "id" : 1
   },
   {
      "action" : "doClick",
      "id" : 2,
      "element" : "<a href=\"/services\">"
   },
   {
      "action" : "doWaitForElement",
      "id" : 3,
      "element" : "#service-wrapper"
   }
]
EOF

phantomjs --ssl-protocol=tlsv1 --ignore-ssl-errors=yes $WTRM file=$TESTJS noimg=true timeout=60

