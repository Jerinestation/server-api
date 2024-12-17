const express = require("express");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const app = express();
const port = process.env.PORT || 8000;
const cors = require('cors');
app.use(cors());



app.use(express.json());

const config_url = " https://script.google.com/macros/s/AKfycbzwclqJRodyVjzYyY-NTQDb9cWG6Hoc5vGAABVtr5-jPA_ET_2IasrAJK4aeo5XoONiaA/exec";
const logs_url = "https://app-tracking.pockethost.io/api/collections/drone_logs/records";

// POST /logs - บันทึกข้อมูล logs
app.post("/log", async (req, res) => {
    try {
        const { drone_id, celsius, country, drone_name } = req.body;

        // ตรวจสอบว่าได้รับข้อมูลที่จำเป็นหรือไม่
        if (!drone_id || !celsius || !country || !drone_name) {
            return res.status(400).send({ error: "Missing required fields." });
        }

        // ข้อมูลสำหรับบันทึก
        const logData = {
            drone_id,
            celsius,
            country,
            drone_name,
            createdAt: new Date() // เพิ่มวันที่เวลาปัจจุบัน
        };

        // ส่งข้อมูลไปยัง API 
        const rawData = await fetch(logs_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(logData)
        });

        if (!rawData.ok) {
            return res.status(rawData.status).send({ error: 'Failed to log temperature.' });
        }

        // อ่านข้อมูล JSON ที่ได้รับกลับ
        const jsonResponse = await rawData.json(); 

        res.send({ status: "success", message: "Temperature logged successfully.", data: jsonResponse });
    } catch (error) {
        console.error("Error logging temperature:", error);
        res.status(500).send({ error: "Error logging temperature" });
    }
});


// GET /logs - ดึงข้อมูล logs ทั้งหมด
app.get("/logs", async (req, res) => {
    try {
        const allLogs = []; 
        let page = 1; 
        let hasMoreData = true; 

        while (hasMoreData) {
            const rawData = await fetch(`${logs_url}?page=${page}`, { method: "GET" });
            const jsonData = await rawData.json();

            // ตรวจสอบว่ามี items หรือไม่
            if (!jsonData.items || !Array.isArray(jsonData.items)) {
                console.error("No items found in fetched data");
                return res.status(404).send({ error: "No logs found" });
            }

            // เพิ่ม logs จากหน้าใหม่ไปยัง allLogs
            allLogs.push(...jsonData.items); 
            hasMoreData = jsonData.items.length > 0; // ตรวจสอบว่ามีข้อมูลในหน้าใหม่หรือไม่
            page++; // ขยับไปยังหน้าใหม่
        }

        res.send(allLogs); // ส่ง logs ทั้งหมดให้ client
    } catch (error) {
        console.error("Error fetching logs:", error);
        res.status(500).send({ error: "Error fetching logs" });
    }
});




// GET /configs - ดึงข้อมูล configs ทั้งหมด
app.get("/configs", async (req, res) => {
    try {
        const rawData = await fetch(config_url, { method: "GET" });
        if (!rawData.ok) {
            throw new Error(`HTTP error! status: ${rawData.status}`);
        }
        const jsonData = await rawData.json();
        console.log("Received data:", jsonData); // พิมพ์ข้อมูลที่ได้รับ

        const config = jsonData.data || []; 

        // ปรับค่าของ max_speed ตามเงื่อนไข
        config.forEach(item => {
            if (item.max_speed === undefined || item.max_speed === null || item.max_speed === "") {
                item.max_speed = 100; // ถ้าไม่มี max_speed ให้ตั้งค่าเป็น 100
            } else if (item.max_speed > 110) {
                item.max_speed = 110; // ถ้า max_speed มากกว่า 110 ให้ตั้งค่าเป็น 110
            }
        });

        res.send(config); // ส่งข้อมูล config กลับไปยังผู้ใช้
    } catch (error) {
        console.error("Error fetching config:", error);
        res.status(500).send({ error: "Error fetching config" });
    }
});


// GET /configs/:id - ดึงข้อมูล config ตาม drone_id
app.get("/configs/:id", async (req, res) => {
    try {
        const rawData = await fetch(config_url, { method: "GET" });
        if (!rawData.ok) {
            throw new Error(`HTTP error! status: ${rawData.status}`);
        }
        const jsonData = await rawData.json();
        console.log("Received data:", jsonData);

        const configs = jsonData.data || []; 
        const id = parseInt(req.params.id);

        // กรองข้อมูลโดยใช้ drone_id
        const filteredConfig = configs.filter(config => config.drone_id === id); 

        // ปรับค่าของ max_speed ตามเงื่อนไข
        filteredConfig.forEach(item => {
            if (item.max_speed === undefined || item.max_speed === null || item.max_speed === "") {
                item.max_speed = 100; // ถ้าไม่มี max_speed ให้ตั้งค่าเป็น 100
            } else if (item.max_speed > 110) {
                item.max_speed = 110; // ถ้า max_speed มากกว่า 110 ให้ตั้งค่าเป็น 110
            }
        });

        if (filteredConfig.length > 0) {
            res.send(filteredConfig); // ส่งข้อมูลที่กรองกลับไปยังผู้ใช้
        } else {
            res.status(404).send({ error: "Config not found" }); // ถ้าไม่พบ config
        }
    } catch (error) {
        console.error("Error fetching config:", error);
        res.status(500).send({ error: "Error fetching config" });
    }
});


// GET /status/:id - ดึงข้อมูล condition ของ config ที่มี drone_id ตามที่ระบุ
app.get("/status/:id", async (req, res) => {
    const droneId = req.params.id; 
    try {
        const rawData = await fetch(config_url, { method: "GET" });
        if (!rawData.ok) {
            throw new Error(`HTTP error! status: ${rawData.status}`);
        }
        const jsonData = await rawData.json();
        console.log("Received data:", jsonData); 

        const configs = jsonData.data || []; 
        // ค้นหา config ที่ตรงกับ drone_id ที่ระบุ
        const filteredConfig = configs.find(config => config.drone_id === parseInt(droneId));

        if (filteredConfig) {
            res.send({ condition: filteredConfig.condition }); // ส่งเฉพาะ condition กลับไปยังผู้ใช้
        } else {
            res.status(404).send({ error: "Config not found" }); // กรณีไม่พบ drone_id
        }
    } catch (error) {
        console.error("Error fetching status:", error);
        res.status(500).send({ error: "Error fetching status" });
    }
});


// DELETE /customers/:id - ลบลูกค้าตาม id
app.delete('/customers/:id', (req, res) => {
    const id = req.params.id;
    const index = customers.findIndex(item => item.id == id);
    if (index !== -1) {
        customers.splice(index, 1);
        res.send({ status: "success", message: "Customer Deleted" });
    } else {
        res.status(404).send({ error: "Customer not found" });
    }
});


// GET / - หน้าแรก
app.get('/', (req, res) => {
    res.send('Hello World!');
});

// Running server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
