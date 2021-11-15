/*
  vue虚拟dom 数组情况下的对比 
    采用的是双端对比 + 最长递增子序列算法
*/

/*  example
    old array [a,b,c,d,e,f,g]
    new array [a,b,e,d,c,h,f,g]
*/

/* 辅助函数
  mountElement 挂载新元素到老元素
  patch 复用老元素
  unmount 卸载老元素
  move 移动老元素元素
*/

exports.diffArray = (c1, c2, { mountElement, patch, unmount, move }) => {
  /**
   * 判断两个节点是否相同 key 和 type
   * @param {*} n1
   * @param {*} n2
   */
  function isSameVNodeType(n1, n2) {
    // n1.key === n2.key && n1.type === n2.type;
    // 这里只模拟 key
    return n1.key === n2.key
  }

  let i = 0
  // 新元素长度
  const l2 = c2.length
  // 最后一个老元素节点下标
  let e1 = c1.length - 1
  // 最后一个新元素节点下标
  let e2 = l2 - 1

  // 1. 左边按序查找， 如果节点不能复用，则停止
  while (i <= e1 && i <= e2) {
    const n1 = c1[i]
    const n2 = c2[i]
    if (isSameVNodeType(n1, n2)) {
      patch(n1.key)
    } else {
      break
    }
    i++
  }

  // 2. 右边按序查找，如果节点不能复用，则停止
  while (i <= e1 && i <= e2) {
    const n1 = c1[e1]
    const n2 = c2[e2]
    if (isSameVNodeType(n1, n2)) {
      patch(n1.key)
    } else {
      break
    }
    e1--
    e2--
  }

  // 3. 老节点没了
  if (i > e1) {
    // 新节点还有, 把新节点挂载到老节点
    if (i <= e2) {
      while (i <= e2) {
        const n2 = c2[i]
        mountElement(n2.key)
        i++
      }
    }
  }

  // 4. 新节点没了
  else if (i > e2) {
    // 老节点还存在的话，逐个删除
    while (i <= e1) {
      const n1 = c1[i]
      unmount(n1.key)
      i++
    }
  }

  // 5. 新老节点都有的情况下， 就会有新增、删除、移动
  else {
    // ab cde fg
    // ab edch fg

    // cde
    // edch

    // 老元素遍历到下标位置
    const s1 = i
    // 新元素遍历到的下标位置
    const s2 = i

    // 5.1 把新元素做成key: index 的map图
    const keyToNewIndexMap = new Map()
    for (i = s2; i <= e2; i++) {
      const nextChild = c2[i]
      keyToNewIndexMap.set(nextChild.key, i)
    }

    // 实时标记现在还剩下多少新元素需要patch
    let patched = 0

    // 标记当前总共剩下有多少新元素需要patch
    const toBePatched = e2 - s2 + 1

    // *5.2 遍历老元素
    let moved = false
    // [i ... e1 + 1]: a b [c d e] f g
    // [i ... e2 + 1]: a b [e d c h] f g
    let maxNewIndexSoFar = 0

    // 标记新节点对应的老节点
    const newIndexToOldIndexMap = new Array(toBePatched)
    for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0

    for (i = s1; i <= e1; i++) {
      const prevChild = c1[i]

      if (patched >= toBePatched) {
        // 复用老元素的个数已经够了
        unmount(prevChild.key)
        continue
      }

      // newIndex是节点在新vdom中的下标
      let newIndex = keyToNewIndexMap.get(prevChild.key)
      if (newIndex === undefined) {
        // 老节点没法复用
        unmount(prevChild.key)
      } else {
        // 节点可以复用
        // 下标是新节点的相对位置 ，值是老节点的下标位置+1>0
        // 遍历newIndexToOldIndexMap，value===0，这个节点没法复用，value>0，节点可以复用
        newIndexToOldIndexMap[newIndex - s2] = i + 1
        if (newIndex >= maxNewIndexSoFar) {
          maxNewIndexSoFar = newIndex
        } else {
          // 新老元素的相对位置发生了变化
          moved = true
        }
        patch(prevChild.key)
        patched++
      }
    }

    // 5.3 遍历新元素 有 move mountElement操作

    // 最长递增子序列的元素不需要动
    const increasingNewIndexSequence = moved
      ? getSequence(newIndexToOldIndexMap)
      : []

    // 最后一个元素下标
    let lastIndex = increasingNewIndexSequence.length - 1

    // e d c h
    for (i = toBePatched - 1; i >= 0; i--) {
      // 老节点下标
      const nextIndex = s2 + i
      const nextChild = c2[nextIndex]
      // todo 判断是move还是mount
      // 如果说当前节点是老节点中就有的，就move，否则就是mount
      if (newIndexToOldIndexMap[i] === 0) {
        // 节点没法复用
        mountElement(nextChild.key)
      } else if (moved) {
        // 节点可能要移动
        if (lastIndex < 0 || i !== increasingNewIndexSequence[lastIndex]) {
          move(nextChild.key)
        } else {
          lastIndex--
        }
      }
    }

    // 最长递增子序列算法
    function getSequence(arr) {
      //   初始值是arr，p[i]记录第i个位置的索引
      const recordIndexOfI = arr.slice()
      const result = [0]
      const len = arr.length

      let resultLastIndex
      let resultLast

      for (let i = 0; i < len; i++) {
        const arrI = arr[i]
        if (arrI !== 0) {
          // result最后一个元素
          resultLastIndex = result.length - 1
          resultLast = result[resultLastIndex]
          if (arr[resultLast] < arrI) {
            recordIndexOfI[i] = resultLast
            result.push(i)
            continue
          }
          let left = 0,
            right = resultLastIndex
          while (left < right) {
            const mid = (left + right) >> 1
            if (arr[result[mid]] < arrI) {
              left = mid + 1
            } else {
              right = mid
            }
          }

          if (arrI < arr[result[left]]) {
            if (left > 0) {
              recordIndexOfI[i] = result[left - 1]
            }
            result[left] = i
          }
        }
      }

      console.log('resss', result) //sy-log

      //  recordIndexOfI记录了正确的索引 result 进而找到最终正确的索引
      resultLastIndex = result.length - 1
      resultLast = result[resultLastIndex]

      while (resultLastIndex >= 0) {
        result[resultLastIndex] = resultLast
        resultLast = recordIndexOfI[resultLast]
        resultLastIndex--
      }
      console.log('recordIndexOfI', recordIndexOfI) //sy-log

      return result
    }
  }
}
