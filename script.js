// =====================================================
// 1) เกณฑ์ระดับสารอาหารต่อ 100 กรัม (แก้ตัวเลขตรงนี้ได้เลย)
//    ค่า <= low  → ต่ำ (เขียว)
//    ค่า >  high → สูง (แดง)
//    ระหว่างนั้น  → ปานกลาง (เหลือง)
// =====================================================
const LIMITS = {
  sugars:       { low: 5,   high: 22.5 },
  fat:          { low: 3,   high: 17.5 },
  saturatedFat: { low: 1.5, high: 5 },
  salt:         { low: 0.3, high: 1.5 }
};

// รายการสารอาหารที่จะแสดงในตาราง
// limit = ชื่อเกณฑ์ใน LIMITS (ถ้าไม่มีเกณฑ์ให้ใส่ null)
const NUTRIENTS = [
  { label: "พลังงาน",      key: "energy-kcal_100g",   unit: "กิโลแคลอรี", limit: null },
  { label: "น้ำตาล",        key: "sugars_100g",        unit: "กรัม",       limit: "sugars" },
  { label: "ไขมัน",         key: "fat_100g",           unit: "กรัม",       limit: "fat" },
  { label: "ไขมันอิ่มตัว",   key: "saturated-fat_100g", unit: "กรัม",       limit: "saturatedFat" },
  { label: "เกลือ",         key: "salt_100g",          unit: "กรัม",       limit: "salt" }
];

// ชนิดบาร์โค้ดที่ให้กล้องอ่าน
const BARCODE_FORMATS = [
  "EAN_13",
  "EAN_8",
  "UPC_A",
  "UPC_E"
];

// ต้องอ่านได้เลขเดียวกันติดกันกี่ครั้ง จึงจะยอมรับ (กันอ่านผิด)
// ถ้าสแกนช้าไป ลดเป็น 1 ได้ ถ้ายังอ่านผิดบ่อย เพิ่มเป็น 3
const CONFIRM_COUNT = 2;

// ความกว้างของพื้นที่อ่านภาพ (หน่วย px)
// ไลบรารีจะย่อภาพจากกล้องให้เท่าความกว้างนี้ก่อนอ่าน
// ถ้าใช้ความกว้างจอมือถือ (~350px) เส้นบาร์โค้ดจะเล็กเกินจนอ่านผิด
// จึงตั้งให้กว้าง 1000px แล้วค่อยย่อเฉพาะภาพที่แสดงบนจอให้พอดี
const READER_WIDTH = 1000;


// =====================================================
// 2) ดึงส่วนต่าง ๆ ของหน้าเว็บมาเก็บในตัวแปร
// =====================================================
const input = document.getElementById("barcode");
const searchBtn = document.getElementById("searchBtn");
const messageBox = document.getElementById("message");
const resultBox = document.getElementById("result");

const readerWrap = document.getElementById("readerWrap");
const readerBox = document.getElementById("reader");
const scanHint = document.getElementById("scanHint");
const openCameraBtn = document.getElementById("openCameraBtn");
const stopCameraBtn = document.getElementById("stopCameraBtn");
const nextScanBtn = document.getElementById("nextScanBtn");


// =====================================================
// 3) ฟังก์ชันช่วยแสดงข้อความ
// =====================================================
function showMessage(text, type) {
  messageBox.textContent = text;
  messageBox.className = "message " + type;
}

function hideMessage() {
  messageBox.className = "message hidden";
}

// ถ้าไม่มีข้อความ ให้คืนค่า "-"
function textOrDash(value) {
  if (value === undefined || value === null) {
    return "-";
  }
  const text = String(value).trim();
  if (text === "") {
    return "-";
  }
  return text;
}

// แปลงค่าที่ได้จาก API เป็นตัวเลข ถ้าไม่มีหรือไม่ใช่ตัวเลข ให้คืน null
function toNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const num = Number(value);
  if (isNaN(num)) {
    return null;
  }
  return num;
}


// =====================================================
// 4) ฟังก์ชันคำนวณค่าสารอาหาร
// =====================================================

// อ่านค่าสารอาหาร 1 ตัว
// ถ้าเป็นเกลือแต่ไม่มี salt_100g ให้คำนวณจากโซเดียม: เกลือ = โซเดียม × 2.5
function getNutrientValue(nutriments, key) {
  let value = toNumber(nutriments[key]);

  if (key === "salt_100g" && value === null) {
    const sodium = toNumber(nutriments["sodium_100g"]);
    if (sodium !== null) {
      value = sodium * 2.5;
    }
  }

  return value;
}

// หาระดับของสารอาหาร: คืนค่า "low", "medium", "high" หรือ null
function getLevel(limitName, value) {
  if (limitName === null || value === null) {
    return null;
  }

  const limit = LIMITS[limitName];

  if (value <= limit.low) {
    return "low";
  } else if (value > limit.high) {
    return "high";
  } else {
    return "medium";
  }
}

// สร้างป้ายสีตามระดับ
function createBadge(level) {
  const badge = document.createElement("span");

  if (level === "low") {
    badge.className = "badge badge-low";
    badge.textContent = "ต่ำ";
  } else if (level === "medium") {
    badge.className = "badge badge-medium";
    badge.textContent = "ปานกลาง";
  } else if (level === "high") {
    badge.className = "badge badge-high";
    badge.textContent = "สูง";
  }

  return badge;
}

// จัดรูปแบบตัวเลข เช่น 12.345 → "12.35 กรัม"
function formatValue(value, unit) {
  if (value === null) {
    return "-";
  }
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString("th-TH") + " " + unit;
}


// =====================================================
// 5) แสดงข้อมูลสินค้าบนหน้าเว็บ
// =====================================================
function showProduct(product, barcode) {
  // ชื่อสินค้า: ใช้ชื่อภาษาไทยก่อน ถ้าไม่มีค่อยใช้ชื่ออื่น
  const name = product.product_name_th || product.product_name || product.product_name_en;

  document.getElementById("productName").textContent = textOrDash(name);
  document.getElementById("productBrand").textContent = "ยี่ห้อ: " + textOrDash(product.brands);
  document.getElementById("productBarcode").textContent = "บาร์โค้ด: " + barcode;

  // รูปสินค้า
  const imageBox = document.getElementById("imageBox");
  imageBox.innerHTML = "";

  const imageUrl = product.image_front_url || product.image_url;

  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = "รูปสินค้า";
    img.onerror = function () {
      imageBox.innerHTML = '<span class="no-image">ไม่มีรูปสินค้า</span>';
    };
    imageBox.appendChild(img);
  } else {
    imageBox.innerHTML = '<span class="no-image">ไม่มีรูปสินค้า</span>';
  }

  // ตารางโภชนาการ
  const nutriments = product.nutriments || {};
  const tbody = document.getElementById("nutriTable");
  tbody.innerHTML = "";

  for (const item of NUTRIENTS) {
    const value = getNutrientValue(nutriments, item.key);
    const level = getLevel(item.limit, value);

    const row = document.createElement("tr");

    const labelCell = document.createElement("td");
    labelCell.textContent = item.label;

    const valueCell = document.createElement("td");
    valueCell.className = "value";
    valueCell.textContent = formatValue(value, item.unit);

    const levelCell = document.createElement("td");
    levelCell.className = "level";
    if (level !== null) {
      levelCell.appendChild(createBadge(level));
    }

    row.appendChild(labelCell);
    row.appendChild(valueCell);
    row.appendChild(levelCell);
    tbody.appendChild(row);
  }

  resultBox.classList.remove("hidden");
}


// =====================================================
// 6) ค้นหาสินค้าจาก Open Food Facts
// =====================================================
async function searchProduct(barcode) {
  resultBox.classList.add("hidden");

  if (barcode === "") {
    showMessage("กรุณาพิมพ์เลขบาร์โค้ด", "error");
    return;
  }

  if (!/^\d+$/.test(barcode)) {
    showMessage("เลขบาร์โค้ดต้องเป็นตัวเลขเท่านั้น", "error");
    return;
  }

  showMessage("กำลังค้นหา...", "loading");
  searchBtn.disabled = true;

  try {
    const url = "https://world.openfoodfacts.org/api/v2/product/" + barcode + ".json";
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 0 || !data.product) {
      showMessage("ไม่พบสินค้า (บาร์โค้ด " + barcode + ")\n" +
                  "ถ้าเลขไม่ตรงกับบนสินค้า ให้แก้ในช่องพิมพ์แล้วกด \"ค้นหา\"", "error");
      return;
    }

    hideMessage();
    showProduct(data.product, barcode);
  } catch (error) {
    showMessage("เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่", "error");
  } finally {
    searchBtn.disabled = false;
  }
}


// =====================================================
// 7) ตรวจว่าเลขบาร์โค้ดถูกต้องหรือไม่ (ใช้เลขหลักสุดท้าย = check digit)
// =====================================================

// ตรวจ check digit ของ EAN-13, EAN-8, UPC-A
// วิธีคิด: นับจากขวาไปซ้าย (ไม่นับหลักสุดท้าย) คูณ 3, 1, 3, 1, ... แล้วรวมกัน
//          check digit = (10 - (ผลรวม % 10)) % 10
function isValidCheckDigit(code) {
  if (!/^\d+$/.test(code)) {
    return false;
  }

  const digits = code.split("").map(Number);
  const checkDigit = digits.pop();   // เอาหลักสุดท้ายออกมา

  let sum = 0;
  let weight = 3;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum = sum + digits[i] * weight;
    weight = (weight === 3) ? 1 : 3;
  }

  const expected = (10 - (sum % 10)) % 10;
  return checkDigit === expected;
}

// แปลง UPC-E (8 หลัก) เป็น UPC-A (12 หลัก)
// เพราะฐานข้อมูลเก็บสินค้าด้วยเลขเต็ม
function upcEToUpcA(code) {
  const n = code.split("");
  const system = n[0];
  const check = n[7];
  const last = n[6];
  let middle = "";

  if (last === "0" || last === "1" || last === "2") {
    middle = n[1] + n[2] + last + "0000" + n[3] + n[4] + n[5];
  } else if (last === "3") {
    middle = n[1] + n[2] + n[3] + "00000" + n[4] + n[5];
  } else if (last === "4") {
    middle = n[1] + n[2] + n[3] + n[4] + "00000" + n[5];
  } else {
    middle = n[1] + n[2] + n[3] + n[4] + n[5] + "0000" + last;
  }

  return system + middle + check;
}

// รับเลขที่กล้องอ่านได้ แล้วคืนเลขที่พร้อมค้นหา
// ถ้าเลขไม่ถูกต้อง คืน null (ให้กล้องอ่านใหม่)
function cleanScannedCode(text, formatName) {
  // UPC-E: แปลงเป็นเลขเต็มก่อน แล้วค่อยตรวจ
  if (formatName === "UPC_E") {
    if (text.length !== 8) {
      return null;
    }
    const upcA = upcEToUpcA(text);
    return isValidCheckDigit(upcA) ? upcA : null;
  }

  // EAN-13 = 13 หลัก, UPC-A = 12 หลัก, EAN-8 = 8 หลัก
  if (text.length !== 13 && text.length !== 12 && text.length !== 8) {
    return null;
  }

  return isValidCheckDigit(text) ? text : null;
}


// =====================================================
// 8) กล้องสแกนบาร์โค้ด (ใช้ไลบรารี html5-qrcode)
// =====================================================
let scanner = null;       // ตัวสแกน (สร้างครั้งแรกตอนเปิดกล้อง)
let isScanning = false;   // true = กำลังรออ่านบาร์โค้ด
let lastCode = "";        // เลขที่อ่านได้ล่าสุด
let sameCount = 0;        // อ่านได้เลขเดิมติดกันกี่ครั้งแล้ว

// สลับปุ่มตามสถานะ: "idle" = ยังไม่เปิดกล้อง, "scanning" = กำลังสแกน, "done" = สแกนเสร็จแล้ว
function setCameraButtons(state) {
  openCameraBtn.classList.toggle("hidden", state !== "idle");
  stopCameraBtn.classList.toggle("hidden", state !== "scanning");
  nextScanBtn.classList.toggle("hidden", state !== "done");
  readerWrap.classList.toggle("hidden", state !== "scanning");
  scanHint.classList.toggle("hidden", state !== "scanning");
}

// ย่อพื้นที่อ่านภาพ (กว้าง READER_WIDTH) ให้พอดีกับความกว้างจอ
// ภาพที่ไลบรารีใช้อ่านยังใหญ่เท่าเดิม แค่ภาพที่ตาเห็นถูกย่อลง
function fitReaderToScreen() {
  const scale = readerWrap.clientWidth / READER_WIDTH;
  readerBox.style.width = READER_WIDTH + "px";
  readerBox.style.transform = "scale(" + scale + ")";

  // transform ไม่เปลี่ยนความสูงของกล่อง จึงต้องตั้งความสูงกรอบนอกเอง
  if (readerBox.offsetHeight > 0) {
    readerWrap.style.height = (readerBox.offsetHeight * scale) + "px";
  }
}

// แปลงข้อผิดพลาดของกล้องเป็นคำอธิบายภาษาไทย
function getCameraErrorMessage(error) {
  const text = String(error);

  if (text.includes("NotAllowedError") || text.includes("Permission")) {
    return "ไม่ได้รับอนุญาตให้ใช้กล้อง\n" +
           "วิธีแก้: กดรูปแม่กุญแจข้างช่องที่อยู่เว็บ แล้วเลือก \"อนุญาต\" กล้อง จากนั้นรีเฟรชหน้าเว็บ\n" +
           "iPhone: ไปที่ การตั้งค่า > Safari > กล้อง > อนุญาต";
  }

  if (text.includes("NotFoundError") || text.includes("OverconstrainedError")) {
    return "ไม่พบกล้องบนอุปกรณ์นี้\nวิธีแก้: ลองเปิดหน้าเว็บนี้บนมือถือ หรือพิมพ์เลขบาร์โค้ดแทน";
  }

  if (text.includes("NotReadableError") || text.includes("TrackStartError")) {
    return "กล้องกำลังถูกแอปอื่นใช้งานอยู่\nวิธีแก้: ปิดแอปที่ใช้กล้อง (เช่น แอปกล้อง, LINE, Zoom) แล้วลองใหม่";
  }

  return "เปิดกล้องไม่ได้\n" +
         "วิธีแก้: ถ้าเปิดลิงก์จาก LINE หรือ Facebook ให้กด \"เปิดใน Safari/Chrome\" ก่อน " +
         "หรือพิมพ์เลขบาร์โค้ดแทน";
}

// เปิดกล้อง
async function openCamera() {
  hideMessage();

  // กล้องใช้ได้เฉพาะหน้าเว็บที่เป็น https (หรือ localhost)
  if (!window.isSecureContext) {
    showMessage("เปิดกล้องไม่ได้ เพราะหน้าเว็บนี้ไม่ได้เปิดผ่าน https\n" +
                "วิธีแก้: เปิดผ่านลิงก์ GitHub Pages (https://...) หรือพิมพ์เลขบาร์โค้ดแทน", "error");
    return;
  }

  // ตรวจว่าโหลดไลบรารีจาก CDN สำเร็จหรือไม่
  if (typeof Html5Qrcode === "undefined") {
    showMessage("โหลดตัวอ่านบาร์โค้ดไม่สำเร็จ\nวิธีแก้: ตรวจสอบอินเทอร์เน็ตแล้วรีเฟรชหน้าเว็บ", "error");
    return;
  }

  setCameraButtons("scanning");
  fitReaderToScreen();

  // สร้างตัวสแกนครั้งแรกครั้งเดียว
  if (scanner === null) {
    const formats = BARCODE_FORMATS.map(function (name) {
      return Html5QrcodeSupportedFormats[name];
    });

    scanner = new Html5Qrcode("reader", {
      formatsToSupport: formats,
      verbose: false,
      // ใช้ตัวอ่านบาร์โค้ดของเบราว์เซอร์ถ้ามี (Chrome บน Android อ่านได้เร็วขึ้นมาก)
      experimentalFeatures: { useBarCodeDetectorIfSupported: true }
    });
  }

  // ตั้งค่ากล้อง
  const config = {
    fps: 10,
    // กรอบสแกนเป็นแนวนอน เหมาะกับบาร์โค้ดแบบแท่ง
    qrbox: function (width, height) {
      return {
        width: Math.floor(width * 0.9),
        height: Math.floor(Math.min(height * 0.9, width * 0.45))
      };
    },
    // ปิดการกลับภาพซ้าย-ขวา: ไลบรารีจะลองอ่านภาพที่กลับด้านด้วย
    // ซึ่งทำให้บาร์โค้ดแบบแท่งถูกอ่านเป็นเลขผิด
    disableFlip: true,
    // ขอภาพความละเอียดสูง และให้กล้องปรับโฟกัสอัตโนมัติตลอดเวลา (ถ้ามือถือรองรับ)
    videoConstraints: {
      facingMode: "environment",
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      advanced: [{ focusMode: "continuous" }]
    }
  };

  try {
    isScanning = true;
    lastCode = "";
    sameCount = 0;
    await scanner.start({ facingMode: "environment" }, config, onScanSuccess, function () {
      // ทุกเฟรมที่ยังอ่านไม่ได้จะเข้ามาที่นี่ ไม่ต้องทำอะไร
    });

    // ภาพจากกล้องขึ้นแล้ว ปรับขนาดกรอบให้พอดีจออีกครั้ง
    fitReaderToScreen();
    setTimeout(fitReaderToScreen, 500);
  } catch (error) {
    isScanning = false;
    setCameraButtons("idle");
    showMessage(getCameraErrorMessage(error), "error");
  }
}

// ปิดกล้อง
async function stopCamera() {
  isScanning = false;
  if (scanner !== null && scanner.isScanning) {
    try {
      await scanner.stop();
    } catch (error) {
      // ปิดไม่สำเร็จก็ไม่เป็นไร
    }
  }
}

// เมื่อกล้องอ่านบาร์โค้ดได้ (อาจยังอ่านผิด ต้องตรวจก่อน)
async function onScanSuccess(decodedText, decodedResult) {
  // กันอ่านซ้ำ: ถ้ายอมรับเลขไปแล้ว ให้ข้ามครั้งต่อไป
  if (!isScanning) {
    return;
  }

  // ชนิดบาร์โค้ดที่อ่านได้ เช่น "EAN_13", "UPC_E"
  let formatName = "";
  if (decodedResult && decodedResult.result && decodedResult.result.format) {
    formatName = decodedResult.result.format.formatName;
  }

  // ขั้นที่ 1: ตรวจ check digit ถ้าไม่ผ่าน ไม่สนใจเลขนี้ ให้กล้องอ่านต่อ
  const code = cleanScannedCode(decodedText, formatName);
  if (code === null) {
    return;
  }

  // ขั้นที่ 2: ต้องอ่านได้เลขเดิมติดกันครบ CONFIRM_COUNT ครั้ง
  if (code === lastCode) {
    sameCount = sameCount + 1;
  } else {
    lastCode = code;
    sameCount = 1;
  }
  if (sameCount < CONFIRM_COUNT) {
    return;
  }

  // ผ่านทั้ง 2 ขั้น → ยอมรับเลขนี้
  decodedText = code;

  // หยุดกล้องทันที
  await stopCamera();
  setCameraButtons("done");

  // สั่นเครื่อง (iPhone ไม่รองรับ จึงต้องเช็กก่อน)
  if (navigator.vibrate) {
    navigator.vibrate(200);
  }

  // ใส่เลขลงช่องพิมพ์ แล้วค้นหาเหมือนการพิมพ์เอง
  input.value = decodedText;
  searchProduct(decodedText);
}

// สแกนชิ้นถัดไป
function scanNext() {
  resultBox.classList.add("hidden");
  input.value = "";
  openCamera();
}

// ปิดกล้องโดยผู้ใช้กดปุ่ม
async function onStopClick() {
  await stopCamera();
  setCameraButtons("idle");
}


// =====================================================
// 9) ผูกปุ่มกับฟังก์ชัน
// =====================================================
searchBtn.addEventListener("click", function () {
  searchProduct(input.value.trim());
});

input.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    searchProduct(input.value.trim());
  }
});

openCameraBtn.addEventListener("click", openCamera);
stopCameraBtn.addEventListener("click", onStopClick);
nextScanBtn.addEventListener("click", scanNext);

// หมุนจอหรือเปลี่ยนขนาดหน้าต่าง → ปรับขนาดภาพกล้องให้พอดีใหม่
window.addEventListener("resize", function () {
  if (isScanning) {
    fitReaderToScreen();
  }
});
