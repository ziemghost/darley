use darley::HashTable;
use std::io::BufRead;

const BOOK_URL: &str = "https://www.gutenberg.org/files/98/98-0.txt";

fn main() {
    let resp = reqwest::blocking::get(BOOK_URL)
        .and_then(|r| r.error_for_status())
        .expect("failed to fetch book");
    let reader = std::io::BufReader::new(resp);

    let capacity = 32_768;
    let mut table: HashTable<String, i64> = HashTable::with_capacity(capacity);

    for line in reader.lines() {
        let line = line.expect("failed to read line");
        for word in line
            .split(|c: char| !c.is_alphabetic())
            .filter(|s| !s.is_empty())
        {
            let word = word.to_ascii_lowercase();
            let count = table.get(&word).copied().unwrap_or(0);
            table.insert(word, count + 1);
        }
    }

    let mut top: Vec<(&str, i64)> = table.iter().map(|(k, v)| (k.as_str(), *v)).collect();
    top.sort_unstable_by(|a, b| b.1.cmp(&a.1));
    println!("Top 10 words:");
    for (word, count) in top.iter().take(10) {
        println!("  {word:>12} — {count}");
    }
}
