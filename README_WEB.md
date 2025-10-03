# TechStock Web Application

## 📋 ภาพรวม

TechStock Web Application เป็นระบบจัดการ Azure Resources ที่มี web interface ที่ทันสมัยและใช้งานง่าย พัฒนาด้วย HTML, CSS, และ JavaScript โดยใช้ Actix Web เป็น backend

## 🌟 ฟีเจอร์หลัก

### 🔍 **การค้นหาและกรอง**
- **ค้นหาทั่วไป**: ค้นหาจากชื่อ resource หรือ type
- **กรองตาม Type**: กรองตาม resource type
- **กรองตาม Location**: กรองตาม Azure region
- **กรองตาม Environment**: กรองตาม environment (Production, Development, etc.)
- **กรองตาม Vendor**: กรองตาม vendor/provider
- **🏷️ ค้นหาด้วย Tags**: ค้นหาด้วย key:value pairs
  - รูปแบบ: `Environment:Production` หรือ `AppName:MyApp,Owner:IT`
  - รองรับหลาย tags โดยใช้ comma คั่น

### 📊 **ตารางข้อมูล**
- **Sorting**: คลิกที่ header เพื่อเรียงลำดับ (ascending/descending)
- **Show/Hide Columns**: เลือกคอลัมน์ที่ต้องการแสดง
- **Pagination**: แบ่งหน้าข้อมูลพร้อมเลือกจำนวนรายการต่อหน้า
- **Responsive Design**: ใช้งานได้บนทุกอุปกรณ์

### ✏️ **CRUD Operations**
- **Create**: เพิ่ม Resource และ Subscription ใหม่
- **Read**: แสดงรายการและรายละเอียด
- **Update**: แก้ไขข้อมูล
- **Delete**: ลบข้อมูล (มี confirmation)

### 🎨 **User Interface**
- **Modern Design**: ใช้ CSS Grid และ Flexbox
- **Icons**: Font Awesome icons
- **Toast Notifications**: แจ้งเตือนสถานะการทำงาน
- **Loading Indicators**: แสดงสถานะการโหลด
- **Modal Dialogs**: ฟอร์มแก้ไขแบบ popup

## 🚀 การใช้งาน

### เริ่มต้นใช้งาน

1. **เริ่ม Server**:
   ```bash
   cargo run --bin techstock
   ```

2. **เปิดเว็บเบราว์เซอร์**:
   ```
   http://localhost:8888
   ```

### การค้นหาด้วย Tags

#### รูปแบบการค้นหา:
- **Single Tag**: `Environment:Production`
- **Multiple Tags**: `Environment:Production,Owner:IT,AppName:MyApp`
- **Partial Match**: `Env:Prod` (จะค้นหา Environment ที่มี "Prod")

#### ตัวอย่างการใช้งาน:
```
Environment:Production          # ค้นหา resources ที่มี Environment = Production
AppName:TechStock              # ค้นหา resources ที่มี AppName = TechStock
Owner:IT,Environment:Dev       # ค้นหา resources ที่มี Owner = IT หรือ Environment = Dev
```

### การจัดการคอลัมน์

1. คลิกปุ่ม **"จัดการคอลัมน์"**
2. เลือก/ยกเลิก checkbox ของคอลัมน์ที่ต้องการ
3. การตั้งค่าจะถูกบันทึกใน localStorage

### การเรียงลำดับ

- คลิกที่ header ของคอลัมน์ที่ต้องการเรียง
- คลิกซ้ำเพื่อเปลี่ยนทิศทาง (asc ↔ desc)
- ไอคอนลูกศรจะแสดงทิศทางการเรียง

## 🏗️ โครงสร้างไฟล์

```
static/
├── index.html          # หน้าหลัก
├── css/
│   └── styles.css      # Stylesheet หลัก
└── js/
    └── app.js          # JavaScript application
```

### ไฟล์หลัก

#### `index.html`
- โครงสร้าง HTML หลัก
- Navigation tabs (Resources, Subscriptions)
- Search forms และ filters
- Tables และ modals
- Toast notification container

#### `css/styles.css`
- Modern CSS styling
- Responsive design
- Component-based styles
- Animation และ transitions
- Utility classes

#### `js/app.js`
- Single-page application logic
- API communication
- Event handling
- DOM manipulation
- State management

## 🎯 API Endpoints ที่ใช้

### Resources
```
GET    /api/v1/resources              # List resources with filters
POST   /api/v1/resources              # Create resource
GET    /api/v1/resources/{id}         # Get resource by ID
PUT    /api/v1/resources/{id}         # Update resource
DELETE /api/v1/resources/{id}         # Delete resource
GET    /api/v1/resources/stats        # Get statistics
```

### Subscriptions
```
GET    /api/v1/subscriptions          # List subscriptions
POST   /api/v1/subscriptions          # Create subscription
GET    /api/v1/subscriptions/{id}     # Get subscription by ID
PUT    /api/v1/subscriptions/{id}     # Update subscription
DELETE /api/v1/subscriptions/{id}     # Delete subscription
```

### Health & Stats
```
GET    /health                        # Health check
GET    /stats                         # Application statistics
```

## 🔧 Query Parameters

### Resources Filtering
```
?page=1                    # หน้าที่ต้องการ
&size=20                   # จำนวนรายการต่อหน้า
&search=web                # ค้นหาทั่วไป
&resource_type=vm          # กรองตาม type
&location=eastus           # กรองตาม location
&environment=prod          # กรองตาม environment
&vendor=microsoft          # กรองตาม vendor
&tags=Environment:Production,Owner:IT  # ค้นหาด้วย tags
&sort_field=name           # เรียงตามฟิลด์
&sort_direction=asc        # ทิศทางการเรียง (asc/desc)
```

## 🎨 การปรับแต่ง UI

### สี Theme
```css
:root {
  --primary-color: #667eea;
  --success-color: #48bb78;
  --warning-color: #ed8936;
  --danger-color: #f56565;
  --info-color: #4299e1;
}
```

### Responsive Breakpoints
- **Desktop**: > 768px
- **Tablet**: 768px - 1024px
- **Mobile**: < 768px

## 🔒 การรักษาความปลอดภัย

- **SQL Injection Prevention**: ใช้ parameterized queries
- **XSS Prevention**: Escape user input
- **CORS**: กำหนด allowed origins
- **Input Validation**: ตรวจสอบข้อมูลทั้ง client และ server side

## 📱 การใช้งานบนมือถือ

- **Responsive Design**: ปรับตัวตามขนาดหน้าจอ
- **Touch-Friendly**: ปุ่มและ controls ขนาดเหมาะสม
- **Mobile Navigation**: เมนูแบบ collapsible
- **Optimized Tables**: แสดงข้อมูลแบบ scrollable

## 🚀 Performance

- **Lazy Loading**: โหลดข้อมูลเมื่อต้องการ
- **Pagination**: แบ่งข้อมูลเป็นหน้า
- **Caching**: บันทึกการตั้งค่า UI ใน localStorage
- **Optimized Queries**: ใช้ index และ efficient queries

## 🐛 การแก้ไขปัญหา

### ปัญหาที่พบบ่อย

1. **ไม่สามารถโหลดข้อมูลได้**
   - ตรวจสอบว่า API server ทำงานอยู่
   - เช็ค network tab ใน browser dev tools

2. **Tags search ไม่ทำงาน**
   - ตรวจสอบรูปแบบ: `key:value`
   - ใช้ comma คั่นสำหรับหลาย tags

3. **Sorting ไม่ทำงาน**
   - ตรวจสอบว่าคอลัมน์มี `sortable` class
   - เช็ค JavaScript console สำหรับ errors

### Debug Mode
เปิด browser developer tools (F12) เพื่อดู:
- **Console**: JavaScript errors
- **Network**: API calls และ responses
- **Application**: localStorage data

## 📈 การพัฒนาต่อ

### ฟีเจอร์ที่อาจเพิ่มในอนาคต
- **Export Data**: ส่งออกข้อมูลเป็น CSV/Excel
- **Advanced Filters**: กรองแบบซับซ้อนมากขึ้น
- **Bulk Operations**: จัดการหลายรายการพร้อมกัน
- **Real-time Updates**: อัปเดตข้อมูลแบบ real-time
- **Dashboard**: หน้า dashboard พร้อม charts
- **User Management**: ระบบจัดการผู้ใช้

---

**TechStock Web Application** - Modern Azure Resource Management Interface 🚀
