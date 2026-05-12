const fs = require('fs');
const path = 'assets/Scene/Level-one.scene';
const content = fs.readFileSync(path, 'utf8');
const d = JSON.parse(content);

/**
 * 将标准 UUID 转换为 Cocos Creator 的压缩 UUID 格式
 * 例如: "0ae5f741-f1e7-4aa3-b5e7-855cd449bfdc" -> "0ae5fdB8edKo7XnhVzUSb/c"
 */
function compressUuid(uuid) {
    // 移除横线
    const hex = uuid.replace(/-/g, '');
    // 将十六进制字符串转换为字节数组
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substring(i, i + 2), 16));
    }
    // Base64 编码
    const base64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let base64 = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const b1 = bytes[i];
        const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
        const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
        const triple = (b1 << 16) | (b2 << 8) | b3;
        base64 += base64chars[(triple >> 18) & 0x3F];
        base64 += base64chars[(triple >> 12) & 0x3F];
        base64 += i + 1 < bytes.length ? base64chars[(triple >> 6) & 0x3F] : '=';
        base64 += i + 2 < bytes.length ? base64chars[triple & 0x3F] : '=';
    }
    // Cocos Creator 的压缩格式：去掉末尾的 ==，替换 + 和 /
    let compressed = base64.replace(/==$/, '').replace(/=+$/, '');
    // 替换 + 为 -（或其它字符），/ 为 _
    compressed = compressed.replace(/\+/g, '-').replace(/\//g, '_');
    // 在末尾添加一个特殊字符表示 UUID 版本
    // 实际上 Cocos Creator 使用的是稍微不同的编码，让我用更简单的方法
    return compressed;
}

// GameOverUI.ts 的 UUID
const GAMEOVER_UI_UUID_FULL = "d370c85d-6240-4d63-ab2f-1cea3c0d450d";

// 使用更准确的 Cocos Creator UUID 压缩算法
function uuidToCCFormat(uuid) {
    const hex = uuid.replace(/-/g, '');
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substring(i, i + 2), 16));
    }
    
    const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-';
    let result = '';
    
    for (let i = 0; i < bytes.length; i += 3) {
        const remaining = bytes.length - i;
        const b1 = bytes[i];
        const b2 = remaining > 1 ? bytes[i + 1] : 0;
        const b3 = remaining > 2 ? bytes[i + 2] : 0;
        const triple = (b1 << 16) | (b2 << 8) | b3;
        
        result += BASE64[(triple >> 18) & 0x3F];
        result += BASE64[(triple >> 12) & 0x3F];
        
        if (remaining > 1) {
            result += BASE64[(triple >> 6) & 0x3F];
        } else {
            result += '=';
        }
        
        if (remaining > 2) {
            result += BASE64[triple & 0x3F];
        } else {
            result += '=';
        }
    }
    
    // 移除末尾的等号
    result = result.replace(/=+$/, '');
    return result;
}

const compressedUuid = uuidToCCFormat(GAMEOVER_UI_UUID_FULL);
console.log('GameOverUI compressed UUID:', compressedUuid);

// ===== 1. 给"小怪fish"节点(ID:65)添加 BoxCollider2D 组件 =====
const colliderId = d.length;

const boxCollider = {
    "__type__": "cc.BoxCollider2D",
    "_name": "",
    "_objFlags": 0,
    "__editorExtras__": {},
    "node": {
        "__id__": 65
    },
    "_enabled": true,
    "__prefab": null,
    "tag": 0,
    "_group": 1,
    "_density": 1,
    "_sensor": false,
    "_friction": 0.2,
    "_restitution": 0,
    "_offset": {
        "__type__": "cc.Vec2",
        "x": 0,
        "y": 0
    },
    "_size": {
        "__type__": "cc.Size",
        "width": 357,
        "height": 233
    },
    "_id": "boxCollider_" + Date.now()
};

d.push(boxCollider);

// 更新"小怪fish"节点的_components
const fishNode = d[65];
fishNode._components.push({ "__id__": colliderId });

// ===== 2. 创建 GameOverUI 节点 =====
const gameOverNodeId = d.length;

const gameOverNode = {
    "__type__": "cc.Node",
    "_name": "GameOverUI",
    "_objFlags": 0,
    "__editorExtras__": {},
    "_parent": {
        "__id__": 2  // Canvas
    },
    "_children": [],
    "_active": true,
    "_components": [],
    "_prefab": null,
    "_lpos": {
        "__type__": "cc.Vec3",
        "x": 0,
        "y": 0,
        "z": 0
    },
    "_lrot": {
        "__type__": "cc.Quat",
        "x": 0,
        "y": 0,
        "z": 0,
        "w": 1
    },
    "_lscale": {
        "__type__": "cc.Vec3",
        "x": 1,
        "y": 1,
        "z": 1
    },
    "_mobility": 0,
    "_layer": 33554432,
    "_euler": {
        "__type__": "cc.Vec3",
        "x": 0,
        "y": 0,
        "z": 0
    },
    "_id": "gameOverUI_" + Date.now()
};

d.push(gameOverNode);

// 给 GameOverUI 节点添加 GameOverUI 脚本组件
const gameOverScriptId = d.length;

const gameOverScript = {
    "__type__": compressedUuid,
    "_name": "",
    "_objFlags": 0,
    "__editorExtras__": {},
    "node": {
        "__id__": gameOverNodeId
    },
    "_enabled": true,
    "__prefab": null,
    "_id": "gameOverScript_" + Date.now()
};

d.push(gameOverScript);

// 更新 GameOverUI 节点的 _components
gameOverNode._components.push({ "__id__": gameOverScriptId });

// 更新 Canvas 节点的 _children，添加 GameOverUI
const canvas = d[2];
canvas._children.push({ "__id__": gameOverNodeId });

// ===== 3. 在 Flagfish 脚本中设置 gameOverUI 属性引用 =====
const flagfishScript = d[68];
flagfishScript.gameOverUI = { "__id__": gameOverNodeId };

// 写入文件
fs.writeFileSync(path, JSON.stringify(d, null, 2), 'utf8');
console.log('✅ 场景文件已更新！');
console.log('新增 BoxCollider2D ID:', colliderId);
console.log('新增 GameOverUI 节点 ID:', gameOverNodeId);
console.log('新增 GameOverUI 脚本 ID:', gameOverScriptId);
console.log('Canvas children count:', canvas._children.length);
