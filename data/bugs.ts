import { BugExercise } from "./types";

export const bugExercises: BugExercise[] = [
  {
    id: "b1",
    title: "Máximo de ventana",
    description: "Debe devolver la suma máxima de cualquier ventana de tamaño k. Con [1,2,3,4] y k=2 devuelve 5 en vez de 7.",
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
    explanation: "El rango `k..<nums.count - 1` deja afuera el último elemento. Debe ser `k..<nums.count`.",
    fixedLine: "    for i in k..<nums.count {",
  },
  {
    id: "b2",
    title: "Quitar pares",
    description: "Debe eliminar los números pares del array. Crashea con 'Index out of range'.",
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
    explanation: "Se muta el array mientras se recorre por índice: el rango se calculó con el count original. Usá `arr.removeAll { $0 % 2 == 0 }` o `input.filter { $0 % 2 != 0 }`.",
    fixedLine: "    arr.removeAll { $0 % 2 == 0 }",
  },
  {
    id: "b3",
    title: "Palíndromo",
    description: "Debe decir si una palabra es palíndromo ignorando mayúsculas. 'Ana' devuelve false.",
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
    explanation: "Nunca se normaliza a minúsculas: 'A' ≠ 'a'. Debe ser `Array(s.lowercased())`.",
    fixedLine: "    let chars = Array(s.lowercased())",
  },
  {
    id: "b4",
    title: "Promedio",
    description: "Debe devolver el promedio de un array de enteros. Con [1, 2] devuelve 1.0 en vez de 1.5.",
    code: `func average(_ nums: [Int]) -> Double {
    guard !nums.isEmpty else { return 0 }
    let total = nums.reduce(0, +)
    return Double(total / nums.count)
}`,
    bugLine: 4,
    explanation: "La división se hace entre `Int` antes de convertir: 3 / 2 = 1. Convertí primero: `Double(total) / Double(nums.count)`.",
    fixedLine: "    return Double(total) / Double(nums.count)",
  },
  {
    id: "b5",
    title: "Búsqueda binaria",
    description: "Debe devolver el índice del target en un array ordenado o -1. A veces entra en loop infinito.",
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
    explanation: "Cuando `a[mid] < target` se asigna `lo = mid` y, si `lo == mid`, no avanza nunca. Debe ser `lo = mid + 1`.",
    fixedLine: "        if a[mid] < target { lo = mid + 1 } else { hi = mid - 1 }",
  },
  {
    id: "b6",
    title: "Retain cycle en ViewModel",
    description: "El ViewModel nunca se libera (Leaks lo marca). ¿Dónde está la fuga?",
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
    explanation: "El closure de `sink` captura `self` fuerte y el ViewModel retiene el cancellable que retiene el closure: ciclo. Usá `.sink { [weak self] value in self?.name = value }`.",
    fixedLine: "            .sink { [weak self] value in",
  },
  {
    id: "b7",
    title: "Contador de vocales",
    description: "Debe contar vocales. Con 'hola' devuelve 0.",
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
    explanation: "El `return count` está dentro del `for`: sale en la primera iteración. Debe ir después del loop.",
    fixedLine: "    }",
  },
  {
    id: "b8",
    title: "Actualizar UI desde background",
    description: "La app muestra un warning morado 'Publishing changes from background threads is not allowed'.",
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
    explanation: "La asignación a `@Published` ocurre en un hilo cualquiera. Marcá la clase con `@MainActor` o hacé `await MainActor.run { self.items = result }`.",
    fixedLine: "            await MainActor.run { self.items = result }",
  },
];
