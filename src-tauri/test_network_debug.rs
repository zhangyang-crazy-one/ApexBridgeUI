// 网络连接调试测试
// 用于验证 httpbin.org 的可达性

fn main() {
    println!("=== 网络连接调试测试 ===\n");

    // 测试1: 简单的 GET 请求
    println!("测试1: 尝试访问 httpbin.org/get");
    match reqwest::blocking::get("https://httpbin.org/get") {
        Ok(response) => {
            println!("✅ 成功! 状态码: {}", response.status());
            if let Ok(text) = response.text() {
                println!("响应长度: {} 字节", text.len());
            }
        }
        Err(e) => {
            println!("❌ 失败! 错误: {}", e);
            println!("错误类型: {:?}", e.to_string());
        }
    }

    println!("\n测试2: 带超时的 GET 请求 (5秒)");
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .unwrap();

    match client.get("https://httpbin.org/get").send() {
        Ok(response) => {
            println!("✅ 成功! 状态码: {}", response.status());
        }
        Err(e) => {
            println!("❌ 失败! 错误: {}", e);
            if e.is_timeout() {
                println!("错误原因: 超时");
            } else if e.is_connect() {
                println!("错误原因: 连接失败");
            } else if e.is_request() {
                println!("错误原因: 请求失败");
            }
        }
    }

    println!("\n测试3: POST 请求");
    match client.post("https://httpbin.org/post")
        .body("{\"test\":\"data\"}")
        .send() {
        Ok(response) => {
            println!("✅ 成功! 状态码: {}", response.status());
        }
        Err(e) => {
            println!("❌ 失败! 错误: {}", e);
        }
    }

    println!("\n=== 测试完成 ===");
}
