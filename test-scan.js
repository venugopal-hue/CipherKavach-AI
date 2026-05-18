const fs = require('fs');

const formData = new FormData();
const fileContent = Buffer.from(JSON.stringify({
  dependencies: {
    "lodash": "4.17.15"
  }
}));
const blob = new Blob([fileContent], { type: "application/json" });
formData.append("file", blob, "demo.json");

fetch("http://localhost:3000/api/scan", {
  method: "POST",
  body: formData
})
.then(res => res.text())
.then(console.log)
.catch(console.error);
