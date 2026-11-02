import { BugExercise } from "../types";

export const bugExercises: BugExercise[] = [
  {
    id: "b1",
    title: "Window maximum",
    description: "It should return the maximum sum of any window of size k. With [1,2,3,4] and k=2 it returns 5 instead of 7.",
    code: `func maxWindowSum(_ nums: [Int], _ k: Int) -> Int {
    guard k > 0, k <= nums.count else { return 0 }
    var sum = nums[0..<k].reduce(0, +)
    var best = sum
    for i in k..<nums.count - 1 {
        sum += nums[i] - nums[i - k]
        best = max(best, sum)
    }
    return best
}`,
    bugLine: 5,
    explanation: "The range `k..<nums.count - 1` leaves out the last element. It should be `k..<nums.count`.",
    fixedLine: "    for i in k..<nums.count {",
  },
  {
    id: "b2",
    title: "Remove evens",
    description: "It should remove the even numbers from the array. It crashes with 'Index out of range'.",
    code: `func removeEvens(_ input: [Int]) -> [Int] {
    var arr = input
    for i in 0..<arr.count {
        if arr[i] % 2 == 0 {
            arr.remove(at: i)
        }
    }
    return arr
}`,
    bugLine: 3,
    explanation: "The array is mutated while being iterated by index: the range was computed with the original count. Use `arr.removeAll { $0 % 2 == 0 }` or `input.filter { $0 % 2 != 0 }`.",
    fixedLine: "    arr.removeAll { $0 % 2 == 0 }",
  },
  {
    id: "b3",
    title: "Palindrome",
    description: "It should tell whether a word is a palindrome, ignoring case. 'Anna' returns false.",
    code: `func isPalindrome(_ s: String) -> Bool {
    let chars = Array(s)
    var i = 0, j = chars.count - 1
    while i < j {
        if chars[i] != chars[j] { return false }
        i += 1; j -= 1
    }
    return true
}`,
    bugLine: 2,
    explanation: "It never normalizes to lowercase: 'A' ≠ 'a'. It should be `Array(s.lowercased())`.",
    fixedLine: "    let chars = Array(s.lowercased())",
  },
  {
    id: "b4",
    title: "Average",
    description: "It should return the average of an array of integers. With [1, 2] it returns 1.0 instead of 1.5.",
    code: `func average(_ nums: [Int]) -> Double {
    guard !nums.isEmpty else { return 0 }
    let total = nums.reduce(0, +)
    return Double(total / nums.count)
}`,
    bugLine: 4,
    explanation: "The division happens between `Int`s before converting: 3 / 2 = 1. Convert first: `Double(total) / Double(nums.count)`.",
    fixedLine: "    return Double(total) / Double(nums.count)",
  },
  {
    id: "b5",
    title: "Binary search",
    description: "It should return the index of the target in a sorted array, or -1. Sometimes it gets stuck in an infinite loop.",
    code: `func binarySearch(_ a: [Int], _ target: Int) -> Int {
    var lo = 0, hi = a.count - 1
    while lo <= hi {
        let mid = (lo + hi) / 2
        if a[mid] == target { return mid }
        if a[mid] < target { lo = mid } else { hi = mid - 1 }
    }
    return -1
}`,
    bugLine: 6,
    explanation: "When `a[mid] < target` it assigns `lo = mid` and, if `lo == mid`, it never advances. It should be `lo = mid + 1`.",
    fixedLine: "        if a[mid] < target { lo = mid + 1 } else { hi = mid - 1 }",
  },
  {
    id: "b6",
    title: "Retain cycle in a ViewModel",
    description: "The ViewModel is never released (Leaks flags it). Where's the leak?",
    code: `final class ProfileViewModel {
    private var cancellable: AnyCancellable?
    @Published var name = ""
    init(service: ProfileService) {
        cancellable = service.namePublisher
            .sink { value in
                self.name = value
            }
    }
}`,
    bugLine: 6,
    explanation: "The `sink` closure captures `self` strongly, and the ViewModel retains the cancellable, which retains the closure: a cycle. Use `.sink { [weak self] value in self?.name = value }`.",
    fixedLine: "            .sink { [weak self] value in",
  },
  {
    id: "b7",
    title: "Vowel counter",
    description: "It should count vowels. With 'hello' it returns 0.",
    code: `func vowelCount(_ s: String) -> Int {
    let vowels: Set<Character> = ["a", "e", "i", "o", "u"]
    var count = 0
    for c in s.lowercased() {
        if vowels.contains(c) { count += 1 }
        return count
    }
    return count
}`,
    bugLine: 6,
    explanation: "The `return count` is inside the `for`: it exits on the first iteration. It belongs after the loop.",
    fixedLine: "    }",
  },
  {
    id: "b8",
    title: "Updating the UI from the background",
    description: "The app shows a purple warning 'Publishing changes from background threads is not allowed'.",
    code: `final class FeedViewModel: ObservableObject {
    @Published var items: [Item] = []
    func load() {
        Task {
            let result = try await api.fetchItems()
            self.items = result
        }
    }
}`,
    bugLine: 6,
    explanation: "The assignment to `@Published` happens on an arbitrary thread. Mark the class with `@MainActor` or use `await MainActor.run { self.items = result }`.",
    fixedLine: "            await MainActor.run { self.items = result }",
  },
];
