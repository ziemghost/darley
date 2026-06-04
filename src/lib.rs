use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

#[derive(Debug, Clone)]
struct Entry<K, V> {
    key: K,
    value: V,
    prev: Option<usize>,
    next: Option<usize>,
}

#[derive(Debug, Clone)]
enum Slot<K, V> {
    Empty,
    Tombstone,
    Occupied(Entry<K, V>),
}

impl<K, V> Slot<K, V> {
    fn entry_as_ref(&self) -> Option<&Entry<K, V>> {
        match self {
            Slot::Occupied(e) => Some(e),
            _ => None,
        }
    }

    fn entry_as_mut(&mut self) -> Option<&mut Entry<K, V>> {
        match self {
            Slot::Occupied(e) => Some(e),
            _ => None,
        }
    }
}

#[derive(Debug)]
pub struct HashTable<K, V> {
    slots: Vec<Slot<K, V>>,
    capacity: usize,
    len: usize,
    head: Option<usize>,
    tail: Option<usize>,
}

impl<K: Hash + Eq, V> HashTable<K, V> {
    pub fn with_capacity(capacity: usize) -> Self {
        assert!(capacity > 0, "capacity must be > 0");
        let mut slots = Vec::with_capacity(capacity);
        for _ in 0..capacity {
            slots.push(Slot::Empty);
        }
        Self {
            slots,
            capacity,
            len: 0,
            head: None,
            tail: None,
        }
    }

    pub fn len(&self) -> usize {
        self.len
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    pub fn is_full(&self) -> bool {
        self.len == self.capacity
    }

    fn hash_of(&self, key: &K) -> usize {
        let mut h = DefaultHasher::new();
        key.hash(&mut h);
        (h.finish() as usize) % self.capacity
    }

    fn find(&self, key: &K) -> Option<usize> {
        let start = self.hash_of(key);
        for i in 0..self.capacity {
            let idx = (start + i) % self.capacity;
            match &self.slots[idx] {
                Slot::Tombstone => continue,
                Slot::Empty => return None,
                Slot::Occupied(e) => {
                    if e.key == *key {
                        return Some(idx);
                    } else {
                        continue;
                    }
                }
            }
        }
        None
    }

    /// Find a suitable place for insert, or return entry idx if same key
    // ok for insert, err for overwrite. not actually an err, but don't want to bring `either` here
    // none if full
    fn probe_for_insert(&self, key: &K) -> Option<Result<usize, usize>> {
        let start = self.hash_of(key);
        let mut first_tombstone: Option<usize> = None;
        for i in 0..self.capacity {
            let idx = (start + i) % self.capacity;
            match &self.slots[idx] {
                Slot::Empty => {
                    return Some(Ok(first_tombstone.unwrap_or(idx)));
                }
                Slot::Tombstone => {
                    if first_tombstone.is_none() {
                        first_tombstone = Some(idx);
                    }
                }
                Slot::Occupied(e) => {
                    if e.key == *key {
                        return Some(Err(idx));
                    } else {
                        continue;
                    }
                }
            }
        }

        first_tombstone.map(Ok)
    }

    fn unlink(&mut self, idx: usize) {
        let (prev, next) = {
            let e = self.slots[idx]
                .entry_as_ref()
                .expect("unlink: not occupied");
            (e.prev, e.next)
        };
        match prev {
            Some(p) => self.slots[p].entry_as_mut().unwrap().next = next,
            None => self.head = next,
        }
        match next {
            Some(n) => self.slots[n].entry_as_mut().unwrap().prev = prev,
            None => self.tail = prev,
        }
        let e = self.slots[idx].entry_as_mut().unwrap();
        e.prev = None;
        e.next = None;
    }

    fn push_back(&mut self, idx: usize) {
        let old_tail = self.tail;
        {
            let e = self.slots[idx]
                .entry_as_mut()
                .expect("push_back: not occupied");
            e.prev = old_tail;
            e.next = None;
        }
        match old_tail {
            Some(t) => self.slots[t].entry_as_mut().unwrap().next = Some(idx),
            None => self.head = Some(idx),
        }
        self.tail = Some(idx);
    }

    pub fn insert(&mut self, key: K, value: V) -> Option<V> {
        match self.probe_for_insert(&key).expect("hashmap full") {
            // just insert
            Ok(idx) => {
                self.slots[idx] = Slot::Occupied(Entry {
                    key,
                    value,
                    prev: None,
                    next: None,
                });
                self.push_back(idx);
                self.len += 1;
                None
            }
            // overwrite
            Err(idx) => {
                let old =
                    std::mem::replace(&mut self.slots[idx].entry_as_mut().unwrap().value, value);
                self.unlink(idx);
                self.push_back(idx);
                Some(old)
            }
        }
    }

    pub fn get(&self, key: &K) -> Option<&V> {
        self.find(key)
            .map(|i| &self.slots[i].entry_as_ref().unwrap().value)
    }

    pub fn remove(&mut self, key: &K) -> Option<V> {
        let idx = self.find(key)?;
        self.unlink(idx);
        let entry = std::mem::replace(&mut self.slots[idx], Slot::Tombstone);
        self.len -= 1;
        match entry {
            Slot::Occupied(e) => Some(e.value),
            _ => unreachable!(),
        }
    }

    pub fn get_first(&self) -> Option<(&K, &V)> {
        self.head.map(|i| {
            let e = self.slots[i].entry_as_ref().unwrap();
            (&e.key, &e.value)
        })
    }

    pub fn get_last(&self) -> Option<(&K, &V)> {
        self.tail.map(|i| {
            let e = self.slots[i].entry_as_ref().unwrap();
            (&e.key, &e.value)
        })
    }

    pub fn iter(&self) -> impl Iterator<Item = (&K, &V)> {
        self.slots.iter().filter_map(|slot| {
            slot.entry_as_ref().map(|e| (&e.key, &e.value))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_operations() {
        let mut t: HashTable<String, i64> = HashTable::with_capacity(8);

        // Insert
        assert_eq!(t.insert("a".into(), 1), None);
        assert_eq!(t.insert("b".into(), 2), None);
        assert_eq!(t.insert("c".into(), 3), None);
        assert_eq!(t.len(), 3);

        // Get
        assert_eq!(t.get(&"a".into()), Some(&1));
        assert_eq!(t.get(&"b".into()), Some(&2));
        assert_eq!(t.get(&"missing".into()), None);

        // Update (moves to tail)
        assert_eq!(t.insert("a".into(), 100), Some(1));
        assert_eq!(t.get(&"a".into()), Some(&100));
        assert_eq!(t.get_last().map(|(k, _)| k.clone()), Some("a".into()));
        assert_eq!(t.get_first().map(|(k, _)| k.clone()), Some("b".into()));

        // Remove
        assert_eq!(t.remove(&"b".into()), Some(2));
        assert_eq!(t.get(&"b".into()), None);
        assert_eq!(t.len(), 2);
        assert_eq!(t.get_first().map(|(k, _)| k.clone()), Some("c".into()));

        // Remove all
        t.remove(&"c".into());
        t.remove(&"a".into());
        assert!(t.is_empty());
        assert_eq!(t.get_first(), None);
        assert_eq!(t.get_last(), None);
    }

    #[derive(Debug, Clone, PartialEq, Eq)]
    struct TestKey(i32, u64);

    impl Hash for TestKey {
        fn hash<H: Hasher>(&self, state: &mut H) {
            self.1.hash(state);
        }
    }

    #[test]
    fn tombstone_removal_test() {
        let mut t: HashTable<TestKey, i32> = HashTable::with_capacity(4);
        t.insert(TestKey(1, 0), 10);
        t.insert(TestKey(2, 0), 20);
        t.insert(TestKey(3, 0), 30);

        t.remove(&TestKey(2, 0));
        assert_eq!(t.get(&TestKey(3, 0)), Some(&30));
        assert_eq!(t.get(&TestKey(1, 0)), Some(&10));
        assert_eq!(t.get(&TestKey(2, 0)), None);
    }

    #[test]
    #[should_panic(expected = "hashmap full")]
    fn full_table_panics() {
        let mut t: HashTable<TestKey, i32> = HashTable::with_capacity(4);
        t.insert(TestKey(1, 0), 10);
        t.insert(TestKey(2, 0), 20);
        t.insert(TestKey(3, 0), 30);
        t.insert(TestKey(4, 99), 40);
        // Table is now full — fifth insert with a new key should panic.
        t.insert(TestKey(5, 42), 50);
    }
}
