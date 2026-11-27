// The feature picker enhances the page. Without JavaScript, all four examples stay readable.
const picker = document.querySelector(".screen-picker");
const buttons = [...picker.querySelectorAll("button")];
function showExample(selected){
  for(const button of buttons){
    const active = button === selected;
    button.setAttribute("aria-pressed", String(active));
    document.getElementById(button.getAttribute("aria-controls")).hidden = !active;
  }
}
showExample(buttons[0]);
picker.hidden = false;
picker.addEventListener("click", event => {
  const selected = event.target.closest("button");
  if(selected) showExample(selected);
});

// Deployment values live on this document's <html>. The app never loads this script.
const { goatcounterSite, feedbackForm } = document.documentElement.dataset;
if(/^https:\/\/tally\.so\/r\/[a-z0-9]+$/i.test(feedbackForm)){
  const link = document.getElementById("feedback-form");
  link.href = feedbackForm;
  link.hidden = false;
}

const landingPath = "/wealth-planner/about/";
if(location.origin === "https://luizfds.github.io" && /^[a-z0-9][a-z0-9-]{0,62}$/.test(goatcounterSite)){
  document.getElementById("analytics-note").hidden = false;
  if(navigator.doNotTrack !== "1" && navigator.globalPrivacyControl !== true){
    // Send only a fixed path. Don't pass the URL's query, fragment, referrer or cookies.
    const pixel = new URL("https://" + goatcounterSite + ".goatcounter.com/count");
    pixel.searchParams.set("p", landingPath);
    fetch(pixel, { mode: "no-cors", credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" }).catch(() => {});
  }
}
